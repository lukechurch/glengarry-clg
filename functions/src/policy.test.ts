import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_FILE_SIZE,
  publicRecord,
  uploadSchema,
  validateFile,
  type DocumentRecord,
  type VersionRecord,
} from "./policy.js";

test("public projection includes only the explicitly published version and no member notes or paths", () => {
  const published: VersionRecord = {
    id: "v1",
    number: 1,
    filename: "minutes.pdf",
    contentType: "application/pdf",
    size: 100,
    storagePath: "secret/path",
    createdAt: "2026-01-01",
    note: "Private comment",
    uploadedBy: "Private name",
  };
  const record: DocumentRecord = {
    title: "Minutes",
    description: "Meeting record",
    category: "Meeting minutes",
    createdAt: "2026-01-01",
    updatedAt: "2026-02-01",
    latestVersion: {
      ...published,
      id: "v2",
      number: 2,
      filename: "private-draft.pdf",
    },
    publishedVersion: published,
    publishedAt: "2026-01-02",
    isPublic: true,
  };
  const result = publicRecord("doc", record)!;
  assert.equal(result.version.id, "v1");
  assert.equal(result.version.filename, "minutes.pdf");
  for (const privateValue of [
    "Private comment",
    "Private name",
    "secret/path",
    "private-draft.pdf",
    "latestVersion",
  ])
    assert.equal(JSON.stringify(result).includes(privateValue), false);
  assert.equal(publicRecord("doc", { ...record, isPublic: false }), null);
  assert.equal(
    publicRecord("doc", { ...record, publishedVersion: null }),
    null,
  );
});

test("uploads reject active content, mismatched file signatures, empty and oversized files", () => {
  assert.throws(() =>
    validateFile("page.html", Buffer.from("<script>alert(1)</script>")),
  );
  assert.throws(() => validateFile("false.pdf", Buffer.from("not a PDF")));
  assert.throws(() => validateFile("empty.txt", Buffer.alloc(0)));
  assert.throws(() =>
    validateFile("large.txt", Buffer.alloc(MAX_FILE_SIZE + 1)),
  );
  assert.equal(
    validateFile("../../minutes.pdf", Buffer.from("%PDF-1.4\n")).filename,
    "minutes.pdf",
  );
  assert.equal(
    validateFile("NOTES.TXT", Buffer.from("Hello")).contentType,
    "text/plain",
  );
});

test("metadata requires meaningful titles and rejects client-supplied access settings", () => {
  const valid = {
    title: " Minutes ",
    description: "",
    category: "Meeting minutes",
    note: "",
  };
  assert.equal(uploadSchema.parse(valid).title, "Minutes");
  assert.equal(
    uploadSchema.safeParse({ ...valid, title: "   " }).success,
    false,
  );
  assert.equal(
    uploadSchema.safeParse({ ...valid, isPublic: true }).success,
    false,
  );
  assert.equal(
    uploadSchema.safeParse({ ...valid, documentId: "../../members/admin" })
      .success,
    false,
  );
  assert.equal(
    uploadSchema.safeParse({ ...valid, note: "x".repeat(501) }).success,
    false,
  );
});
