import { useRef, useState, type FormEvent } from "react";
import { Check, FileText, LockKeyhole, UploadCloud } from "lucide-react";
import { api } from "./api";
import { categories, type Category, type LibraryDocument } from "./types";
import { ErrorMessage, formatSize, Modal } from "./components";

export default function UploadDialog({
  document,
  onClose,
  onSaved,
}: {
  document?: LibraryDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(document?.title ?? "");
  const [description, setDescription] = useState(document?.description ?? "");
  const [category, setCategory] = useState<Category>(
    document?.category ?? "Meeting minutes",
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const choose = (selected?: File) => {
    if (!selected) return;
    if (!/\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test(selected.name)) {
      setError("Choose a PDF, Word, Excel, PowerPoint, text or CSV document.");
      return;
    }
    if (selected.size > 25 * 1024 * 1024 || selected.size === 0) {
      setError("Choose a file with content, smaller than 25 MB.");
      return;
    }
    setError("");
    setFile(selected);
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a document to upload.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.upload(
        {
          title,
          description,
          category,
          note,
          ...(document ? { documentId: document.id } : {}),
        },
        file,
        setProgress,
      );
      onSaved();
    } catch (error) {
      setError((error as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={document ? "Upload a new version" : "Upload a document"}
      subtitle={
        document ? document.title : "Add a document to the member library."
      }
      onClose={onClose}
      locked={busy}
    >
      <form onSubmit={submit} className="upload-form">
        <div
          className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) choose(event.dataTransfer.files[0]);
          }}
        >
          {file ? <FileText size={30} /> : <UploadCloud size={30} />}
          <strong>{file ? file.name : "Drag your document here"}</strong>
          {file ? (
            <span>{formatSize(file.size)} · Ready to upload</span>
          ) : (
            <span>PDF, Word, Excel, PowerPoint, text or CSV · up to 25 MB</span>
          )}
          <button
            type="button"
            className="button secondary small"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {file ? "Choose another file" : "Choose a file"}
          </button>
          <input
            ref={input}
            className="visually-hidden"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
            tabIndex={-1}
            aria-label="Document file"
            onChange={(event) => choose(event.target.files?.[0])}
            disabled={busy}
          />
        </div>
        {!document && (
          <>
            <label>
              Document title
              <input
                autoComplete="off"
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={busy}
                placeholder="For example, September meeting minutes"
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as Category)
                }
                disabled={busy}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Description{" "}
              <span className="optional">
                Optional · visible when published
              </span>
              <textarea
                rows={2}
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={busy}
                placeholder="A short summary to help people find the right document."
              />
            </label>
          </>
        )}
        <label>
          Version note <span className="optional">Optional · members only</span>
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={busy}
            placeholder={
              document
                ? "What has changed in this version?"
                : "Any notes for other members."
            }
          />
        </label>
        <div className="notice subtle">
          <LockKeyhole size={18} />
          <span>
            {document?.publishedVersion
              ? `Version ${document.publishedVersion.number} will remain public. You can publish the new version after uploading.`
              : "This document will be private until a member publishes it."}
          </span>
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {busy && (
          <div className="upload-progress" role="status">
            <div>
              <span>
                {progress >= 95 ? "Saving document…" : "Uploading document…"}
              </span>
              <span>{progress}%</span>
            </div>
            <progress max="100" value={progress} aria-label="Upload progress" />
          </div>
        )}
        <div className="modal-footer">
          <button
            className="button secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              "Uploading…"
            ) : (
              <>
                <Check size={17} />
                {document ? "Save new version" : "Upload document"}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
