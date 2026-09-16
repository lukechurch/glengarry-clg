import express from "express";
import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ZodError } from "zod";
import { pipeline } from "node:stream/promises";
import { parseUpload } from "./multipart.js";
import {
  HttpError,
  idSchema,
  memberRecord,
  memberVersion,
  publicRecord,
  type DocumentRecord,
  type VersionRecord,
} from "./policy.js";

export const app = express();
app.disable("x-powered-by");
app.disable("etag");
app.use((_req, res, next) => {
  res.set({
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  next();
});
app.use(express.json({ limit: "16kb" }));

app.get("/api/public/documents", async (_req, res) => {
  const snapshot = await getFirestore()
    .collection("documents")
    .where("isPublic", "==", true)
    .get();
  const documents = snapshot.docs
    .map((doc) => publicRecord(doc.id, doc.data() as DocumentRecord))
    .filter(Boolean);
  documents.sort((a, b) => b!.publishedAt.localeCompare(a!.publishedAt));
  res.json({ documents });
});

async function sendFile(res: express.Response, version: VersionRecord) {
  const file = getStorage().bucket().file(version.storagePath);
  const [exists] = await file.exists();
  if (!exists)
    throw new HttpError(
      404,
      "This file is currently unavailable. Please contact the group.",
    );
  res.attachment(version.filename);
  res.set("Content-Type", version.contentType);
  res.set("Content-Length", String(version.size));
  await pipeline(file.createReadStream(), res);
}

app.get("/api/public/documents/:id/download", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const snapshot = await getFirestore().doc(`documents/${id}`).get();
  const record = snapshot.data() as DocumentRecord | undefined;
  if (!record?.isPublic || !record.publishedVersion)
    throw new HttpError(404, "This document is no longer public.");
  // Authorize on every request; never expose a permanent Storage download token.
  await sendFile(res, record.publishedVersion);
});

app.use("/api/member", async (req, res, next) => {
  const header = req.get("Authorization");
  if (!header?.startsWith("Bearer "))
    throw new HttpError(401, "Sign in to continue.");
  let token;
  try {
    token = await getAuth().verifyIdToken(header.slice(7), true);
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  const member = await getFirestore().doc(`members/${token.uid}`).get();
  if (!member.exists || member.data()?.active !== true)
    throw new HttpError(
      403,
      "Access is available to invited members only. Contact the group if you need an invitation.",
    );
  res.locals.member = {
    uid: token.uid,
    name: member.data()!.name,
    email: token.email ?? "",
  };
  next();
});

app.get("/api/member/me", (_req, res) => {
  res.json({ member: res.locals.member });
});
app.get("/api/member/documents", async (_req, res) => {
  const snapshot = await getFirestore()
    .collection("documents")
    .orderBy("updatedAt", "desc")
    .get();
  res.json({
    documents: snapshot.docs.map((doc) =>
      memberRecord(doc.id, doc.data() as DocumentRecord),
    ),
  });
});
app.get("/api/member/documents/:id/versions", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const snapshot = await getFirestore()
    .collection(`documents/${id}/versions`)
    .orderBy("number", "desc")
    .get();
  res.json({
    versions: snapshot.docs.map((doc) =>
      memberVersion(doc.data() as VersionRecord),
    ),
  });
});
app.get(
  "/api/member/documents/:id/versions/:versionId/download",
  async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const versionId = idSchema.parse(req.params.versionId);
    const snapshot = await getFirestore()
      .doc(`documents/${id}/versions/${versionId}`)
      .get();
    if (!snapshot.exists)
      throw new HttpError(404, "This version could not be found.");
    await sendFile(res, snapshot.data() as VersionRecord);
  },
);

app.post("/api/member/documents", async (req, res) => {
  const { input, data, filename, contentType } = await parseUpload(req);
  const db = getFirestore();
  const id = input.documentId ?? randomUUID();
  const versionId = randomUUID();
  const reference = db.doc(`documents/${id}`);
  if (input.documentId && !(await reference.get()).exists)
    throw new HttpError(404, "The original document could not be found.");
  const storagePath = `documents/${id}/versions/${versionId}/${filename}`;
  const file = getStorage().bucket().file(storagePath);
  await file.save(data, {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: {
      contentType,
      cacheControl: "private, no-store",
      contentDisposition: "attachment",
    },
  });
  try {
    const record = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (input.documentId && !existing.exists)
        throw new HttpError(404, "The original document could not be found.");
      const previous = existing.data() as DocumentRecord | undefined;
      const now = new Date().toISOString();
      const version: VersionRecord = {
        id: versionId,
        number: (previous?.latestVersion.number ?? 0) + 1,
        filename,
        contentType,
        size: data.length,
        storagePath,
        createdAt: now,
        note: input.note,
        uploadedBy: res.locals.member.name,
      };
      const document: DocumentRecord = {
        title: previous?.title ?? input.title,
        description: previous?.description ?? input.description,
        category: previous?.category ?? input.category,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        latestVersion: version,
        publishedVersion: previous?.publishedVersion ?? null,
        publishedAt: previous?.publishedAt ?? null,
        isPublic: previous?.isPublic ?? false,
      };
      transaction.create(
        reference.collection("versions").doc(versionId),
        version,
      );
      transaction.set(reference, document);
      return document;
    });
    res.status(201).json({ document: memberRecord(id, record) });
  } catch (error) {
    // Do not leave unreferenced files after a failed metadata transaction.
    await file
      .delete({ ignoreNotFound: true })
      .catch((cleanupError) =>
        console.error("Upload cleanup failed", cleanupError),
      );
    throw error;
  }
});

app.post("/api/member/documents/:id/publish", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const versionId = idSchema.parse(req.body?.versionId);
  const db = getFirestore();
  const reference = db.doc(`documents/${id}`);
  await db.runTransaction(async (transaction) => {
    const [snapshot, version] = await Promise.all([
      transaction.get(reference),
      transaction.get(reference.collection("versions").doc(versionId)),
    ]);
    if (!snapshot.exists || !version.exists)
      throw new HttpError(404, "The document version could not be found.");
    const record = snapshot.data() as DocumentRecord;
    // A newer upload must be reviewed before it can be published.
    if (record.latestVersion.id !== versionId)
      throw new HttpError(
        409,
        "A newer version has been uploaded. Refresh the library and review it before publishing.",
      );
    transaction.update(reference, {
      publishedVersion: version.data(),
      publishedAt: new Date().toISOString(),
      isPublic: true,
    });
  });
  res.json({ success: true });
});

app.delete("/api/member/documents/:id/publication", async (req, res) => {
  const id = idSchema.parse(req.params.id);
  const reference = getFirestore().doc(`documents/${id}`);
  await getFirestore().runTransaction(async (transaction) => {
    if (!(await transaction.get(reference)).exists)
      throw new HttpError(404, "This document could not be found.");
    transaction.update(reference, {
      publishedVersion: null,
      publishedAt: null,
      isPublic: false,
    });
  });
  res.json({ success: true });
});

app.use((_req, _res) => {
  throw new HttpError(404, "This address could not be found.");
});
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Check the document details and try again.",
        details: error.flatten(),
      });
      return;
    }
    console.error("Document API error", error);
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again in a moment." });
  },
);
