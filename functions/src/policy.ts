import { z } from "zod";

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const idSchema = z.string().uuid();
export const uploadSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).default(""),
    category: z.enum([
      "Meeting minutes",
      "Agendas",
      "Reports",
      "Group information",
      "Other",
    ]),
    note: z.string().trim().max(500).default(""),
    documentId: idSchema.optional(),
  })
  .strict();

const fileTypes: Record<string, { mime: string; signature?: number[] }> = {
  pdf: { mime: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
  doc: {
    mime: "application/msword",
    signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
  xls: {
    mime: "application/vnd.ms-excel",
    signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
  ppt: {
    mime: "application/vnd.ms-powerpoint",
    signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
  txt: { mime: "text/plain" },
  csv: { mime: "text/csv" },
};

export function validateFile(filename: string, data: Buffer) {
  if (!data.length)
    throw new HttpError(
      400,
      "The file is empty. Choose a document with content.",
    );
  if (data.length > MAX_FILE_SIZE)
    throw new HttpError(413, "Choose a file smaller than 25 MB.");
  const safeName = filename
    .split(/[/\\]/)
    .pop()!
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  if (!safeName || safeName.length > 200)
    throw new HttpError(400, "Use a filename of 200 characters or fewer.");
  const type = fileTypes[safeName.split(".").pop()!.toLowerCase()];
  if (!type)
    throw new HttpError(
      400,
      "Choose a PDF, Word, Excel, PowerPoint, text or CSV document.",
    );
  if (
    type.signature &&
    !type.signature.every((byte, index) => data[index] === byte)
  ) {
    throw new HttpError(
      400,
      "The file content does not match its extension. Export the document again and retry.",
    );
  }
  return { filename: safeName, contentType: type.mime };
}

export type VersionRecord = {
  id: string;
  number: number;
  filename: string;
  contentType: string;
  size: number;
  storagePath: string;
  createdAt: string;
  note: string;
  uploadedBy: string;
};
export type DocumentRecord = {
  title: string;
  description: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: VersionRecord;
  publishedVersion: VersionRecord | null;
  publishedAt: string | null;
  isPublic: boolean;
};
export function publicRecord(id: string, record: DocumentRecord) {
  if (!record.isPublic || !record.publishedVersion || !record.publishedAt)
    return null;
  const {
    id: versionId,
    number,
    filename,
    contentType,
    size,
  } = record.publishedVersion;
  return {
    id,
    title: record.title,
    description: record.description,
    category: record.category,
    publishedAt: record.publishedAt,
    version: { id: versionId, number, filename, contentType, size },
  };
}
export function memberVersion(version: VersionRecord) {
  const { storagePath: _path, ...safe } = version;
  return safe;
}
export function memberRecord(id: string, record: DocumentRecord) {
  return {
    id,
    title: record.title,
    description: record.description,
    category: record.category,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
    latestVersion: memberVersion(record.latestVersion),
    publishedVersion: record.publishedVersion
      ? memberVersion(record.publishedVersion)
      : null,
  };
}
