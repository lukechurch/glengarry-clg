import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../functions/package.json", import.meta.url),
);
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

// Never permit these tests to reach production, even if invoked incorrectly.
for (const key of [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "FIREBASE_STORAGE_EMULATOR_HOST",
]) {
  assert.match(
    process.env[key] ?? "",
    /^(127\.0\.0\.1|localhost):\d+$/,
    `${key} must point to a local emulator`,
  );
}
const projectId = "demo-glengarry-clg";
const app = initializeApp({
  projectId,
  storageBucket: `${projectId}.appspot.com`,
});
const db = getFirestore();
const base = `http://127.0.0.1:5001/${projectId}/europe-west2/api/api`;
const authBase = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
after(() => deleteApp(app));

async function user(email, member = true) {
  const account = await getAuth().createUser({
    email,
    password: "Emulator-only-Password!23",
  });
  if (member)
    await db
      .doc(`members/${account.uid}`)
      .set({ name: "Test member", email, active: true });
  const response = await fetch(
    `${authBase}/accounts:signInWithPassword?key=fake-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "Emulator-only-Password!23",
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(response.status, 200);
  return { uid: account.uid, token: (await response.json()).idToken };
}
async function call(path, token, init = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}
async function upload(
  token,
  documentId,
  text = "First version",
  filename = "record.txt",
) {
  const form = new FormData();
  form.append(
    "metadata",
    JSON.stringify({
      title: "Integration test record",
      description: "Public summary",
      category: "Meeting minutes",
      note: "MEMBERS-ONLY NOTE",
      ...(documentId ? { documentId } : {}),
    }),
  );
  form.append("file", new Blob([text], { type: "text/plain" }), filename);
  return call("/member/documents", token, { method: "POST", body: form });
}
async function publish(token, document) {
  return call(`/member/documents/${document.id}/publish`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId: document.latestVersion.id }),
  });
}

test("invitation, storage, versioning, publication, concurrency and revocation work end to end", async () => {
  const member = await user("member@example.com");
  const outsider = await user("outsider@example.com", false);
  assert.equal((await call("/member/documents")).status, 401);
  assert.equal((await call("/member/documents", "invalid-token")).status, 401);
  assert.equal((await call("/member/documents", outsider.token)).status, 403);
  assert.equal((await upload(outsider.token)).status, 403);

  const uploaded = await upload(member.token);
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const first = (await uploaded.json()).document;
  assert.equal(first.latestVersion.number, 1);
  assert.equal(first.publishedVersion, null);
  assert.equal(
    (await call(`/public/documents/${first.id}/download`)).status,
    404,
  );
  assert.deepEqual(
    (await (await call("/public/documents")).json()).documents,
    [],
  );
  const stored = (await db.doc(`documents/${first.id}`).get()).data();
  const [metadata] = await getStorage()
    .bucket()
    .file(stored.latestVersion.storagePath)
    .getMetadata();
  assert.equal(metadata.metadata?.firebaseStorageDownloadTokens, undefined);
  const direct = await fetch(
    `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${projectId}.appspot.com/o/${encodeURIComponent(stored.latestVersion.storagePath)}?alt=media`,
  );
  assert.equal(direct.status, 403);
  const directFirestore = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/documents/${first.id}`,
  );
  assert.equal(directFirestore.status, 403);

  assert.equal((await publish(member.token, first)).status, 200);
  let publicList = await (await call("/public/documents")).json();
  assert.equal(publicList.documents.length, 1);
  assert.equal(publicList.documents[0].version.number, 1);
  assert.equal(JSON.stringify(publicList).includes("MEMBERS-ONLY NOTE"), false);
  assert.equal(JSON.stringify(publicList).includes("uploadedBy"), false);
  assert.equal(JSON.stringify(publicList).includes("storagePath"), false);
  let download = await call(`/public/documents/${first.id}/download`);
  assert.match(download.headers.get("cache-control"), /no-store/);
  assert.match(download.headers.get("content-disposition"), /attachment/);
  assert.equal(await download.text(), "First version");

  const secondResponse = await upload(
    member.token,
    first.id,
    "Unpublished second version",
  );
  assert.equal(secondResponse.status, 201);
  const second = (await secondResponse.json()).document;
  assert.equal(second.latestVersion.number, 2);
  publicList = await (await call("/public/documents")).json();
  assert.equal(publicList.documents[0].version.number, 1);
  assert.equal(
    await (await call(`/public/documents/${first.id}/download`)).text(),
    "First version",
  );
  assert.equal((await publish(member.token, first)).status, 409);
  assert.equal((await publish(member.token, second)).status, 200);
  assert.equal(
    await (await call(`/public/documents/${first.id}/download`)).text(),
    "Unpublished second version",
  );

  const parallel = await Promise.all([
    upload(member.token, first.id, "Concurrent revision A"),
    upload(member.token, first.id, "Concurrent revision B"),
  ]);
  assert.deepEqual(
    parallel.map((result) => result.status),
    [201, 201],
  );
  const parallelDocs = await Promise.all(
    parallel.map((result) => result.json()),
  );
  assert.deepEqual(
    parallelDocs.map((result) => result.document.latestVersion.number).sort(),
    [3, 4],
  );
  const history = await (
    await call(`/member/documents/${first.id}/versions`, member.token)
  ).json();
  assert.deepEqual(
    history.versions.map((version) => version.number),
    [4, 3, 2, 1],
  );
  assert.equal(
    await (
      await call(
        `/member/documents/${first.id}/versions/${first.latestVersion.id}/download`,
        member.token,
      )
    ).text(),
    "First version",
  );
  assert.equal(
    (
      await call(
        `/member/documents/${first.id}/versions/${first.latestVersion.id}/download`,
      )
    ).status,
    401,
  );
  assert.equal(
    (await upload(member.token, undefined, "bad", "pretend.pdf")).status,
    400,
  );
  assert.equal(
    (await upload(member.token, undefined, "<script>bad</script>", "bad.html"))
      .status,
    400,
  );

  assert.equal(
    (
      await call(`/member/documents/${first.id}/publication`, member.token, {
        method: "DELETE",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`/public/documents/${first.id}/download`)).status,
    404,
  );
  assert.equal(
    (await (await call("/public/documents")).json()).documents.length,
    0,
  );
  await db.doc(`members/${member.uid}`).update({ active: false });
  assert.equal((await call("/member/documents", member.token)).status, 403);
  assert.equal((await upload(member.token, first.id)).status, 403);
  assert.equal(
    (
      await call(
        `/member/documents/${first.id}/versions/${first.latestVersion.id}/download`,
        member.token,
      )
    ).status,
    403,
  );
});
