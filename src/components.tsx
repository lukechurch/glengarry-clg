import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  FileText,
  LoaderCircle,
  X,
} from "lucide-react";
import { api } from "./api";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
export function formatSize(value: number) {
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={19} />
      <span>{children}</span>
    </div>
  );
}
export function Loading({ text = "Loading documents…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {text}
    </div>
  );
}
export function FileIcon({ filename }: { filename: string }) {
  return (
    <div className="file-icon" aria-hidden="true">
      <FileText size={23} />
      <span>{filename.split(".").pop()?.toUpperCase()}</span>
    </div>
  );
}
export function DownloadButton({
  id,
  filename,
  versionId,
  compact = false,
}: {
  id: string;
  filename: string;
  versionId?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="download-control">
      <button
        className={compact ? "button icon-button" : "button secondary small"}
        aria-label={`Download ${filename}`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await api.download(id, filename, versionId);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle size={17} className="spin" />
        ) : (
          <ArrowDownToLine size={17} />
        )}
        {!compact && (busy ? "Downloading…" : "Download")}
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  locked = false,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  locked?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !locked) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="button icon-button"
          onClick={onClose}
          disabled={locked}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
