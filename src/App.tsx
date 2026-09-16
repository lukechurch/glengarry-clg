import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Globe2,
  History,
  LibraryBig,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { api } from "./api";
import { auth, isDemo } from "./firebase";
import { group } from "./content";
import {
  DownloadButton,
  ErrorMessage,
  FileIcon,
  formatDate,
  formatSize,
  Loading,
  Modal,
} from "./components";
import type { LibraryDocument, Member, PublicDocument, Version } from "./types";
import UploadDialog from "./UploadDialog";

function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

function PublicLibrary() {
  const [documents, setDocuments] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await api.publicDocuments());
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  return (
    <main id="main-content" className="container public-page">
      <div className="intro-grid">
        <PageHeading
          eyebrow="Glengarry Community Liaison Group"
          title="Document library"
        >
          <p>
            Information shared with our community.
            <br className="desktop-break" /> Read the group’s published
            documents and latest updates.
          </p>
        </PageHeading>
        <Link className="about-card" to="/about">
          <span className="card-icon">
            <Users size={23} />
          </span>
          <div>
            <h2>About the group</h2>
            <p>Our purpose and membership</p>
          </div>
          <ArrowRight size={20} />
        </Link>
      </div>
      <section className="library-panel" aria-labelledby="published-heading">
        <div className="panel-header">
          <div className="panel-title">
            <h2 id="published-heading">Published documents</h2>
            {!loading && !error && (
              <span className="count">{documents.length}</span>
            )}
          </div>
          <span className="public-label">
            <Globe2 size={16} /> Public access
          </span>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="panel-message">
            <ErrorMessage>{error}</ErrorMessage>
            <button className="button secondary" onClick={load}>
              Try again
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <LibraryBig size={34} />
            <h3>No public documents yet</h3>
            <p>Documents will appear here when the group publishes them.</p>
          </div>
        ) : (
          <>
            <div className="document-table-heading">
              <span>Document</span>
              <span>Published</span>
              <span>File</span>
              <span className="visually-hidden">Download</span>
            </div>
            <div className="document-list">
              {documents.map((document) => (
                <article className="document-row" key={document.id}>
                  <div className="document-identity">
                    <FileIcon filename={document.version.filename} />
                    <div>
                      <span className="category">{document.category}</span>
                      <h3>{document.title}</h3>
                      <p>{document.description}</p>
                    </div>
                  </div>
                  <div className="date-cell">
                    <span className="mobile-label">Published</span>
                    <time dateTime={document.publishedAt}>
                      {formatDate(document.publishedAt)}
                    </time>
                    <span className="secondary-text">
                      Version {document.version.number}
                    </span>
                  </div>
                  <div className="file-cell">
                    <span>
                      {document.version.filename
                        .split(".")
                        .pop()
                        ?.toUpperCase()}
                    </span>
                    <span className="secondary-text">
                      {formatSize(document.version.size)}
                    </span>
                  </div>
                  <DownloadButton
                    id={document.id}
                    filename={document.version.filename}
                  />
                </article>
              ))}
            </div>
          </>
        )}
        <div className="panel-footer">
          <ShieldCheck size={17} />
          <span>
            Published by members of the Glengarry Community Liaison Group.
          </span>
        </div>
      </section>
      <div className="library-note">
        <BookOpen size={21} />
        <div>
          <h3>A record for the community</h3>
          <p>
            These documents are available to everyone. You don’t need an account
            to download them.
          </p>
        </div>
      </div>
    </main>
  );
}

function About() {
  return (
    <main id="main-content" className="container about-page">
      <PageHeading eyebrow="Our community" title="About the group">
        <p className="about-lead">{group.description}</p>
      </PageHeading>
      <div className="about-layout">
        <div>
          <section className="about-section">
            <h2>Sharing information</h2>
            <p>{group.purpose}</p>
            <Link className="text-link" to="/">
              Browse the document library <ArrowRight size={17} />
            </Link>
          </section>
          <section
            className="about-section"
            aria-labelledby="membership-heading"
          >
            <div className="section-label">
              <Users size={23} />
              <h2 id="membership-heading">Group membership</h2>
            </div>
            <p>{group.membershipIntroduction}</p>
            {group.members.length > 0 && (
              <div className="membership-list">
                {group.members.map((member) => (
                  <article key={`${member.name}-${member.role}`}>
                    <span className="member-avatar" aria-hidden="true">
                      {member.name
                        .split(" ")
                        .map((word) => word[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <h3>{member.name}</h3>
                      <p>{member.role}</p>
                      <span>{member.organisation}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="info-card">
          <LockKeyhole size={23} />
          <h2>For group members</h2>
          <p>
            Invited members can upload documents, keep a version history and
            choose which documents to make public.
          </p>
          <Link className="button secondary" to="/members">
            Member sign in <ArrowRight size={17} />
          </Link>
        </aside>
      </div>
    </main>
  );
}

function Login({
  member,
  checking,
  accessError,
  enterDemo,
}: {
  member: Member | null;
  checking: boolean;
  accessError: string;
  enterDemo: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (member) navigate("/members", { replace: true });
  }, [member, navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!auth) {
      setError("Member sign in will be available when Firebase is connected.");
      return;
    }
    setBusy(true);
    try {
      if (reset) {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage(
          "If an account exists for this email address, you’ll receive a password reset link. Check your inbox and spam folder.",
        );
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const code = (error as { code?: string }).code;
      setError(
        code === "auth/too-many-requests"
          ? "Too many attempts. Please wait a few minutes and try again."
          : code === "auth/network-request-failed"
            ? "We couldn’t connect. Check your internet connection and try again."
            : "We couldn’t sign you in. Check your email and password, or reset your password.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="container login-page">
      <Link className="back-link" to="/">
        <ChevronRight size={16} /> Back to the document library
      </Link>
      <div className="login-layout">
        <section className="login-context">
          <span className="login-emblem">
            <LockKeyhole size={27} />
          </span>
          <p className="eyebrow">Member workspace</p>
          <h1>
            A place for the
            <br />
            group’s documents.
          </h1>
          <p>
            Upload, update and share information with your fellow members and
            the wider community.
          </p>
          <div className="login-feature">
            <ShieldCheck size={20} />
            <span>Access is by invitation from the group.</span>
          </div>
        </section>
        <section className="login-form-panel">
          <div className="section-label">
            <Mail size={21} />
            <span className="eyebrow">Glengarry CLG</span>
          </div>
          <h2>{reset ? "Reset your password" : "Member sign in"}</h2>
          <p>
            {reset
              ? "Enter the email address associated with your membership."
              : "Welcome back. Sign in using your invited email address."}
          </p>
          <form onSubmit={submit}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={busy || checking}
              />
            </label>
            {!reset && (
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy || checking}
                />
              </label>
            )}
            {(error || accessError) && (
              <ErrorMessage>{error || accessError}</ErrorMessage>
            )}
            {message && (
              <div className="notice success" role="status">
                <Check size={19} />
                {message}
              </div>
            )}
            <button
              className="button primary full-width"
              disabled={busy || checking}
            >
              {busy || checking ? (
                "Please wait…"
              ) : reset ? (
                "Send reset link"
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setReset(!reset);
                setError("");
                setMessage("");
              }}
            >
              {reset ? "Back to sign in" : "Forgot your password?"}
            </button>
          </form>
          <div className="invitation-note">
            <CircleHelp size={18} />
            <p>
              Signing in for the first time? Use the link in your invitation to
              set a password.
            </p>
          </div>
          {isDemo && (
            <div className="demo-entry">
              <span>Preview the member tools without an account.</span>
              <button
                className="button secondary full-width"
                onClick={enterDemo}
              >
                Explore member workspace <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function HistoryDialog({
  document,
  onClose,
}: {
  document: LibraryDocument;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .versions(document.id)
      .then(setVersions)
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));
  }, [document.id]);
  return (
    <Modal
      title="Version history"
      subtitle={document.title}
      onClose={onClose}
      wide
    >
      {loading ? (
        <Loading text="Loading version history…" />
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : (
        <div className="version-list">
          {versions.map((version) => (
            <article key={version.id}>
              <div className="version-number">{version.number}</div>
              <div className="version-details">
                <div className="version-title">
                  <h3>Version {version.number}</h3>
                  {version.id === document.latestVersion.id && (
                    <span className="badge neutral">Latest</span>
                  )}
                  {version.id === document.publishedVersion?.id && (
                    <span className="badge public">Public</span>
                  )}
                </div>
                <p>
                  {formatDate(version.createdAt)} · {version.uploadedBy}
                </p>
                {version.note && <p className="version-note">{version.note}</p>}
                <span className="secondary-text">
                  {version.filename} · {formatSize(version.size)}
                </span>
              </div>
              <DownloadButton
                id={document.id}
                filename={version.filename}
                versionId={version.id}
                compact
              />
            </article>
          ))}
        </div>
      )}
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function Workspace({ member }: { member: Member }) {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [upload, setUpload] = useState<LibraryDocument | "new" | null>(null);
  const [history, setHistory] = useState<LibraryDocument | null>(null);
  const [publication, setPublication] = useState<{
    document: LibraryDocument;
    publish: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState("");
  async function load() {
    setError("");
    try {
      setDocuments(await api.memberDocuments());
    } catch (error) {
      setError((error as Error).message);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function changePublication() {
    if (!publication) return;
    setBusy(true);
    setPublishError("");
    try {
      if (publication.publish)
        await api.publish(
          publication.document.id,
          publication.document.latestVersion.id,
        );
      else await api.unpublish(publication.document.id);
      setNotice(
        publication.publish
          ? "The document is now available in the public library."
          : "The document is now private and has been removed from the public library.",
      );
      setPublication(null);
      await load();
    } catch (error) {
      setPublishError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="container workspace-page">
      <div className="workspace-heading">
        <PageHeading eyebrow="Member workspace" title="Manage documents">
          <p>Welcome, {member.name}. Keep the group’s documents up to date.</p>
        </PageHeading>
        <button className="button primary" onClick={() => setUpload("new")}>
          <Plus size={19} /> Upload document
        </button>
      </div>
      <div className="workspace-guidance">
        <LockKeyhole size={19} />
        <span>
          New documents and versions stay private until you publish them.
        </span>
        <Link to="/">
          View public library <ArrowRight size={16} />
        </Link>
      </div>
      {notice && (
        <div className="notice success" role="status">
          <Check size={19} />
          <span>{notice}</span>
          <button
            className="text-button"
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        </div>
      )}
      <section className="library-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h2>All documents</h2>
            <span className="count">{documents.length}</span>
          </div>
          <span className="secondary-text">
            {documents.filter((doc) => doc.publishedVersion).length} public ·{" "}
            {documents.filter((doc) => !doc.publishedVersion).length} private
          </span>
        </div>
        {loading ? (
          <Loading />
        ) : error ? (
          <div className="panel-message">
            <ErrorMessage>{error}</ErrorMessage>
            <button className="button secondary" onClick={load}>
              Try again
            </button>
          </div>
        ) : !documents.length ? (
          <div className="empty-state">
            <Upload size={34} />
            <h3>Your shared library starts here</h3>
            <p>Upload the first document for the group.</p>
            <button className="button primary" onClick={() => setUpload("new")}>
              <Plus size={17} /> Upload document
            </button>
          </div>
        ) : (
          <div className="member-document-list">
            {documents.map((document) => {
              const hasNewVersion =
                document.publishedVersion &&
                document.publishedVersion.id !== document.latestVersion.id;
              return (
                <article className="member-document" key={document.id}>
                  <div className="member-document-top">
                    <div className="document-identity">
                      <FileIcon filename={document.latestVersion.filename} />
                      <div>
                        <span className="category">{document.category}</span>
                        <h3>{document.title}</h3>
                        <p>{document.description}</p>
                      </div>
                    </div>
                    <div className="status-stack">
                      {document.publishedVersion ? (
                        <span className="badge public">
                          <Globe2 size={13} />
                          Public · v{document.publishedVersion.number}
                        </span>
                      ) : (
                        <span className="badge neutral">
                          <LockKeyhole size={13} />
                          Private
                        </span>
                      )}
                      {hasNewVersion && (
                        <span className="badge pending">New version ready</span>
                      )}
                    </div>
                  </div>
                  <div className="member-document-bottom">
                    <div className="version-summary">
                      Version {document.latestVersion.number}
                      <span>·</span>
                      {formatDate(document.updatedAt)}
                      <span>·</span>
                      {formatSize(document.latestVersion.size)}
                    </div>
                    <div className="document-actions">
                      <button
                        className="button quiet small"
                        onClick={() => setHistory(document)}
                        aria-label={`Version history for ${document.title}`}
                      >
                        <History size={16} />
                        History
                      </button>
                      <button
                        className="button quiet small"
                        onClick={() => setUpload(document)}
                        aria-label={`Upload new version of ${document.title}`}
                      >
                        <Upload size={16} />
                        New version
                      </button>
                      {document.publishedVersion && (
                        <button
                          className="button quiet small"
                          onClick={() => {
                            setPublication({ document, publish: false });
                            setPublishError("");
                          }}
                          aria-label={`Make ${document.title} private`}
                        >
                          Make private
                        </button>
                      )}
                      {(!document.publishedVersion || hasNewVersion) && (
                        <button
                          className="button secondary small"
                          onClick={() => {
                            setPublication({ document, publish: true });
                            setPublishError("");
                          }}
                          aria-label={`Publish version ${document.latestVersion.number} of ${document.title}`}
                        >
                          <Globe2 size={15} />
                          {hasNewVersion ? "Publish latest" : "Publish"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {upload && (
        <UploadDialog
          document={upload === "new" ? undefined : upload}
          onClose={() => setUpload(null)}
          onSaved={() => {
            setUpload(null);
            setNotice(
              "Document saved. You can now review it and choose whether to publish it.",
            );
            void load();
          }}
        />
      )}
      {history && (
        <HistoryDialog document={history} onClose={() => setHistory(null)} />
      )}
      {publication && (
        <Modal
          title={
            publication.publish
              ? "Make this version public?"
              : "Make this document private?"
          }
          subtitle={publication.document.title}
          onClose={() => setPublication(null)}
          locked={busy}
        >
          <div className="publication-copy">
            <span
              className={`publication-icon ${publication.publish ? "" : "private"}`}
            >
              {publication.publish ? (
                <Globe2 size={28} />
              ) : (
                <LockKeyhole size={28} />
              )}
            </span>
            <p>
              {publication.publish
                ? `Version ${publication.document.latestVersion.number} will be available for anyone to download from the public library.${publication.document.publishedVersion ? " It will replace the currently published version." : ""}`
                : "The document will be removed from the public library. Members will still have access to every version. Copies already downloaded cannot be recalled."}
            </p>
          </div>
          {publishError && <ErrorMessage>{publishError}</ErrorMessage>}
          <div className="modal-footer">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPublication(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={changePublication}
            >
              {busy
                ? "Saving…"
                : publication.publish
                  ? "Publish document"
                  : "Make private"}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

export default function App() {
  const [member, setMember] = useState<Member | null>(null);
  const [checking, setChecking] = useState(Boolean(auth));
  const [accessError, setAccessError] = useState("");
  const location = useLocation();
  useEffect(() => {
    if (!auth) return;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      setMember(null);
      if (!user) {
        setChecking(false);
        return;
      }
      setChecking(true);
      setAccessError("");
      try {
        const profile = await api.member();
        if (current === generation) setMember(profile);
      } catch (error) {
        if (current === generation) {
          setAccessError((error as Error).message);
          await signOut(auth!);
        }
      } finally {
        if (current === generation) setChecking(false);
      }
    });
    return () => {
      generation++;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${location.pathname === "/about" ? "About the group" : location.pathname === "/members" ? "Member workspace" : location.pathname === "/sign-in" ? "Member sign in" : "Document library"} | Glengarry Community Liaison Group`;
  }, [location.pathname]);
  const enterDemo = () => {
    setMember({
      uid: "preview-member",
      name: "Preview member",
      email: "preview@example.com",
    });
    setAccessError("");
  };
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {isDemo && (
        <div className="preview-banner">
          <span>
            <span className="preview-tag">Local preview</span>Sample documents ·
            changes reset when you refresh
          </span>
        </div>
      )}
      <header className="site-header">
        <div className="container header-inner">
          <Link
            className="brand"
            to="/"
            aria-label="Glengarry Community Liaison Group home"
          >
            <span className="brand-mark" aria-hidden="true">
              G<span>CLG</span>
            </span>
            <span className="brand-name">
              Glengarry<span>Community Liaison Group</span>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            <NavLink to="/" end>
              Documents
            </NavLink>
            <NavLink to="/about">About the group</NavLink>
          </nav>
          <div className="member-nav">
            {member ? (
              <>
                <NavLink className="button secondary small" to="/members">
                  <LibraryBig size={17} />
                  Workspace
                </NavLink>
                <button
                  className="button icon-button"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={async () => {
                    if (auth) await signOut(auth);
                    setMember(null);
                  }}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <NavLink to="/sign-in" className="button secondary small">
                <LockKeyhole size={16} />
                <span>Member sign in</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<PublicLibrary />} />
        <Route path="/about" element={<About />} />
        <Route
          path="/sign-in"
          element={
            <Login
              member={member}
              checking={checking}
              accessError={accessError}
              enterDemo={enterDemo}
            />
          }
        />
        <Route
          path="/members"
          element={
            checking ? (
              <main id="main-content" className="container">
                <Loading text="Checking member access…" />
              </main>
            ) : member ? (
              <Workspace member={member} />
            ) : (
              <Navigate to="/sign-in" replace />
            )
          }
        />
        <Route
          path="*"
          element={
            <main id="main-content" className="container not-found">
              <PageHeading
                eyebrow="Page not found"
                title="This page isn’t here."
              />
              <Link className="button primary" to="/">
                Return to the document library <ArrowRight size={17} />
              </Link>
            </main>
          }
        />
      </Routes>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span>
            Glengarry <span className="footer-divider">/</span> Community
            Liaison Group
          </span>
          <span>© {new Date().getFullYear()} Glengarry CLG</span>
        </div>
      </footer>
    </>
  );
}
