import Busboy from "busboy";
import type { Request } from "express";
import {
  HttpError,
  MAX_FILE_SIZE,
  uploadSchema,
  validateFile,
} from "./policy.js";

export async function parseUpload(req: Request & { rawBody?: Buffer }) {
  return new Promise<{
    input: ReturnType<typeof uploadSchema.parse>;
    data: Buffer;
    filename: string;
    contentType: string;
  }>((resolve, reject) => {
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          fileSize: MAX_FILE_SIZE,
          files: 1,
          fields: 1,
          fieldSize: 8000,
          // Busboy emits partsLimit upon reaching the limit, not exceeding it.
          // The third part is invalid; the expected file + metadata pair is valid.
          parts: 3,
        },
      });
    } catch {
      reject(new HttpError(400, "Choose a document to upload."));
      return;
    }
    let filename = "";
    let metadata = "";
    const chunks: Buffer[] = [];
    let issue: Error | undefined;
    parser.on("field", (name, value, info) => {
      if (name !== "metadata" || info.valueTruncated)
        issue = new HttpError(400, "Document details are missing or too long.");
      else metadata = value;
    });
    parser.on("file", (field, stream, info) => {
      if (field !== "file")
        issue = new HttpError(400, "Unexpected file field.");
      filename = info.filename;
      stream.on("limit", () => {
        issue = new HttpError(413, "Choose a file smaller than 25 MB.");
      });
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"] as const) {
      parser.on(event, () => {
        issue = new HttpError(400, "Upload one document at a time.");
      });
    }
    parser.on("error", () =>
      reject(
        new HttpError(400, "The upload could not be read. Please try again."),
      ),
    );
    parser.on("close", () => {
      if (issue) {
        reject(issue);
        return;
      }
      try {
        let raw: unknown;
        try {
          raw = JSON.parse(metadata);
        } catch {
          throw new HttpError(400, "Document details are missing.");
        }
        const input = uploadSchema.parse(raw);
        const data = Buffer.concat(chunks);
        resolve({ input, data, ...validateFile(filename, data) });
      } catch (error) {
        reject(error);
      }
    });
    // Cloud Functions has already read the request; local Express can use the stream.
    if (req.rawBody) parser.end(req.rawBody);
    else req.pipe(parser);
  });
}
