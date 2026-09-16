import { auth, isDemo } from "./firebase";
import type {
  LibraryDocument,
  Member,
  PublicDocument,
  UploadInput,
  Version,
} from "./types";

const base = import.meta.env.VITE_API_BASE_URL ?? "";
const preview = async () => (await import("./demo")).demo;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
async function authorization(): Promise<Record<string, string>> {
  if (!auth?.currentUser)
    throw new ApiError("Please sign in to continue.", 401);
  return { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` };
}
async function request<T>(
  path: string,
  member = false,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${base}/api/${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(member ? await authorization() : {}),
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({
    error: "The document service is unavailable. Please try again shortly.",
  }));
  if (!response.ok || data.error)
    throw new ApiError(
      data.error ?? "The request could not be completed.",
      response.status,
    );
  return data as T;
}
export const api = {
  async member() {
    return (await request<{ member: Member }>("member/me", true)).member;
  },
  async publicDocuments() {
    return isDemo
      ? (await preview()).publicDocuments()
      : (await request<{ documents: PublicDocument[] }>("public/documents"))
          .documents;
  },
  async memberDocuments() {
    return isDemo
      ? (await preview()).memberDocuments()
      : (
          await request<{ documents: LibraryDocument[] }>(
            "member/documents",
            true,
          )
        ).documents;
  },
  async versions(id: string) {
    return isDemo
      ? (await preview()).versions(id)
      : (
          await request<{ versions: Version[] }>(
            `member/documents/${id}/versions`,
            true,
          )
        ).versions;
  },
  async publish(id: string, versionId: string) {
    if (isDemo) return (await preview()).publish(id, versionId);
    await request(`member/documents/${id}/publish`, true, {
      method: "POST",
      body: JSON.stringify({ versionId }),
    });
  },
  async unpublish(id: string) {
    if (isDemo) return (await preview()).unpublish(id);
    await request(`member/documents/${id}/publication`, true, {
      method: "DELETE",
    });
  },
  async upload(
    input: UploadInput,
    file: File,
    progress: (percent: number) => void,
  ): Promise<LibraryDocument> {
    if (isDemo) return (await preview()).upload(input, file, progress);
    const headers = await authorization();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${base}/api/member/documents`);
      xhr.timeout = 120000;
      Object.entries(headers).forEach(([key, value]) =>
        xhr.setRequestHeader(key, value),
      );
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          progress(Math.round((event.loaded / event.total) * 95));
      };
      xhr.onerror = () =>
        reject(
          new Error(
            "The upload was interrupted. Check your connection and try again.",
          ),
        );
      xhr.ontimeout = () =>
        reject(
          new Error(
            "The upload took too long. Refresh the library before trying again to check whether it was saved.",
          ),
        );
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(
              new ApiError(data.error ?? "The upload failed.", xhr.status),
            );
            return;
          }
          progress(100);
          resolve(data.document);
        } catch {
          reject(
            new Error(
              "The upload response could not be read. Refresh the library to check whether it was saved.",
            ),
          );
        }
      };
      const form = new FormData();
      form.append("metadata", JSON.stringify(input));
      form.append("file", file);
      xhr.send(form);
    });
  },
  async download(id: string, filename: string, versionId?: string) {
    let blob: Blob;
    if (isDemo) blob = await (await preview()).download(id, versionId);
    else {
      const path = versionId
        ? `member/documents/${id}/versions/${versionId}/download`
        : `public/documents/${id}/download`;
      const response = await fetch(`${base}/api/${path}`, {
        headers: versionId ? await authorization() : {},
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(
          error.error ?? "The download failed. Please try again.",
          response.status,
        );
      }
      blob = await response.blob();
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
