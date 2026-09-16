export const categories = [
  "Meeting minutes",
  "Agendas",
  "Reports",
  "Group information",
  "Other",
] as const;
export type Category = (typeof categories)[number];
export type Member = { uid: string; name: string; email: string };
export type Version = {
  id: string;
  number: number;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  note: string;
  uploadedBy: string;
};
export type LibraryDocument = {
  id: string;
  title: string;
  description: string;
  category: Category;
  createdAt: string;
  updatedAt: string;
  latestVersion: Version;
  publishedVersion: Version | null;
  publishedAt: string | null;
};
export type PublicDocument = {
  id: string;
  title: string;
  description: string;
  category: Category;
  publishedAt: string;
  version: Pick<Version, "id" | "number" | "filename" | "contentType" | "size">;
};
export type UploadInput = {
  title: string;
  description: string;
  category: Category;
  note: string;
  documentId?: string;
};
