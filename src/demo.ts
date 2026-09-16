import type {
  LibraryDocument,
  PublicDocument,
  UploadInput,
  Version,
} from "./types";

const files = new Map<string, Blob>();
const histories = new Map<string, Version[]>();
function samplePdf(title: string) {
  const line = title.replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 50 750 Td (Glengarry Community Liaison Group) Tj 0 -40 Td /F1 14 Tf (${line}) Tj 0 -40 Td /F1 11 Tf (SAMPLE DOCUMENT - for local preview only.) Tj 0 -24 Td (This is not an official group record.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}
const seeds = [
  {
    title: "Community liaison meeting minutes",
    description:
      "A record of the discussion and agreed actions from the group meeting.",
    category: "Meeting minutes",
    date: "2026-09-08",
  },
  {
    title: "September meeting agenda",
    description: "Items for discussion at the next community liaison meeting.",
    category: "Agendas",
    date: "2026-09-01",
  },
  {
    title: "Terms of reference",
    description:
      "The purpose, membership and working arrangements of the group.",
    category: "Group information",
    date: "2026-08-20",
  },
  {
    title: "Community update",
    description:
      "An overview of matters discussed and information shared with the group.",
    category: "Reports",
    date: "2026-08-12",
  },
] as const;
let documents: LibraryDocument[] = seeds.map((seed, index) => {
  const id = crypto.randomUUID();
  const blob = samplePdf(seed.title);
  const version: Version = {
    id: crypto.randomUUID(),
    number: 1,
    filename: `${seed.title.toLowerCase().replaceAll(" ", "-")}.pdf`,
    contentType: "application/pdf",
    size: blob.size,
    createdAt: `${seed.date}T12:00:00Z`,
    note: "Sample document for preview.",
    uploadedBy: "Preview member",
  };
  files.set(version.id, blob);
  histories.set(id, [version]);
  return {
    id,
    ...seed,
    createdAt: version.createdAt,
    updatedAt: version.createdAt,
    latestVersion: version,
    publishedVersion: index === 3 ? null : version,
    publishedAt: index === 3 ? null : version.createdAt,
  };
});

export const demo = {
  async publicDocuments(): Promise<PublicDocument[]> {
    return structuredClone(
      documents
        .filter((doc) => doc.publishedVersion)
        .map((doc) => ({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          publishedAt: doc.publishedAt!,
          version: doc.publishedVersion!,
        })),
    );
  },
  async memberDocuments() {
    return structuredClone(documents);
  },
  async versions(id: string) {
    return structuredClone(histories.get(id) ?? []);
  },
  async upload(
    input: UploadInput,
    file: File,
    progress: (percent: number) => void,
  ) {
    progress(30);
    const existing = documents.find((doc) => doc.id === input.documentId);
    const id = existing?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    const version: Version = {
      id: crypto.randomUUID(),
      number: (existing?.latestVersion.number ?? 0) + 1,
      filename: file.name,
      contentType: file.type,
      size: file.size,
      createdAt: now,
      note: input.note,
      uploadedBy: "Preview member",
    };
    files.set(version.id, file);
    histories.set(id, [version, ...(histories.get(id) ?? [])]);
    const document: LibraryDocument = {
      ...input,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      latestVersion: version,
      publishedVersion: existing?.publishedVersion ?? null,
      publishedAt: existing?.publishedAt ?? null,
    };
    documents = [document, ...documents.filter((doc) => doc.id !== id)];
    progress(100);
    return structuredClone(document);
  },
  async publish(id: string, versionId: string) {
    const document = documents.find((doc) => doc.id === id)!;
    document.publishedVersion = histories
      .get(id)!
      .find((version) => version.id === versionId)!;
    document.publishedAt = new Date().toISOString();
  },
  async unpublish(id: string) {
    const document = documents.find((doc) => doc.id === id)!;
    document.publishedVersion = null;
    document.publishedAt = null;
  },
  async download(id: string, versionId?: string) {
    const version =
      versionId ?? documents.find((doc) => doc.id === id)!.publishedVersion!.id;
    return files.get(version)!;
  },
};
