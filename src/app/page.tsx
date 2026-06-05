"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Source = { n: number; file: string; snippet: string };
type Message = { role: "user" | "ai"; text: string; sources?: Source[] };
type FileInfo = { file: string; chunks: number };
type Quiz = { q: string; options: string[]; answer: number; explanation: string };

const TABS = [
  { id: "chat", icon: "💬", label: "AI Tutor" },
  { id: "notes", icon: "✨", label: "Notes" },
  { id: "quiz", icon: "📝", label: "Quiz" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("chat");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/upload").then((r) => r.json()).then((d) => setFiles(d.files || [])).catch(() => {});
  }, []);

  async function handleUpload(fileObjs: FileList | null) {
    if (!fileObjs || !fileObjs.length) return;
    setUploading(true);
    for (const f of Array.from(fileObjs)) {
      setStatus(`Reading "${f.name}" → chunking → embedding…`);
      const fd = new FormData();
      fd.append("file", f);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (data.error) { setStatus("❌ " + data.error); continue; }
        setFiles(data.files || []);
        setStatus(`✅ Indexed "${data.file}" — ${data.chunks} chunks from ${data.pages} pages.`);
      } catch { setStatus("❌ Upload failed."); }
    }
    setUploading(false);
  }

  async function deleteFile(name: string) {
    const res = await fetch("/api/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: name }),
    });
    const data = await res.json();
    if (data.files) setFiles(data.files);
    setStatus(`🗑️ Removed "${name}"`);
  }

  return (
    <div className="flex min-h-screen">
      {/* ===== Sidebar ===== */}
      <aside className="glass m-3 flex w-[270px] flex-col rounded-2xl p-4">
        <div className="mb-5 flex items-center gap-2 px-1 text-lg font-bold">
          🎓 AI Campus <span className="grad-text">OS</span>
        </div>

        <nav className="flex flex-col gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition " +
                (tab === t.id
                  ? "bg-gradient-to-r from-[var(--blue)] to-[var(--purple)] text-white shadow-lg"
                  : "text-[var(--text-dim)] hover:bg-white/5 hover:text-white")
              }>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>

        <div className="my-4 h-px bg-white/10" />

        {/* Library */}
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">📂 Library</div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="mt-2 w-full rounded-xl border border-dashed border-white/15 bg-white/5 py-4 text-center text-sm transition hover:border-[var(--blue)] hover:bg-[var(--blue)]/10 disabled:opacity-50">
          {uploading ? "Working…" : "⬆️ Upload PDF"}
        </button>
        <input ref={fileRef} type="file" accept="application/pdf" multiple hidden
          onChange={(e) => handleUpload(e.target.files)} />
        {status && <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">{status}</p>}

        <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto">
          {files.length === 0 && <p className="text-xs text-[var(--text-faint)]">No documents yet.</p>}
          {files.map((f) => (
            <div key={f.file} className="group flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span>📄</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs">{f.file}</div>
                <div className="text-[10px] text-[var(--text-faint)]">{f.chunks} chunks ✓</div>
              </div>
              <button onClick={() => deleteFile(f.file)}
                className="rounded-md px-1.5 py-0.5 text-xs text-red-400 opacity-0 transition hover:bg-red-500/20 group-hover:opacity-100"
                title="Delete">✕</button>
            </div>
          ))}
        </div>
      </aside>

      {/* ===== Main ===== */}
      <main className="flex-1 p-3">
        <div className="glass flex h-[calc(100vh-24px)] flex-col rounded-2xl p-5">
          {tab === "chat" && <ChatTab hasDocs={files.length > 0} />}
          {tab === "notes" && <NotesTab hasDocs={files.length > 0} />}
          {tab === "quiz" && <QuizTab hasDocs={files.length > 0} />}
        </div>
      </main>
    </div>
  );
}

/* ============ CHAT (1-to-1 conversation) ============ */
function ChatTab({ hasDocs }: { hasDocs: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", text: "Hi! 👋 I'm your AI tutor. Upload a PDF, then let's have a real conversation about it — ask follow-ups and I'll remember what we discussed." },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || thinking) return;
    const history = messages.filter((m) => m.text && !m.text.startsWith("Hi! 👋"));
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setThinking(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "ai", text: data.error ? "❌ " + data.error : data.answer, sources: data.sources }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "❌ Something went wrong." }]);
    }
    setThinking(false);
  }

  return (
    <>
      <Header title="💬 AI Tutor" sub="A real 1-to-1 conversation, grounded in your PDFs — with memory of what you said." />
      <div ref={logRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={"max-w-[80%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed " +
              (m.role === "user"
                ? "rounded-br-sm bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] text-white"
                : "rounded-bl-sm border border-white/10 bg-white/5")}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2">
                  {m.sources.map((s) => (
                    <div key={s.n} className="text-xs text-[var(--cyan)]">
                      <b>[{s.n}] 📄 {s.file}</b>
                      <span className="block text-[var(--text-faint)]">{s.snippet}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="typing rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-dim)]">
              AI is reading your material…
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["Summarize this document", "Explain the key concepts simply", "Give me a real-world example", "Why is that important?"].map((c) => (
          <button key={c} onClick={() => ask(c)} disabled={!hasDocs}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10 disabled:opacity-40">
            {c}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Continue the conversation…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--blue)]" />
        <button type="submit" disabled={thinking}
          className="rounded-xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] px-5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
          Send ➤
        </button>
      </form>
    </>
  );
}

/* ============ NOTES ============ */
function NotesTab({ hasDocs }: { hasDocs: boolean }) {
  const [type, setType] = useState("Short Notes");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true); setNotes("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, topic }),
      });
      const data = await res.json();
      setNotes(data.error ? "❌ " + data.error : data.notes);
    } catch { setNotes("❌ Something went wrong."); }
    setLoading(false);
  }

  return (
    <>
      <Header title="✨ AI Notes Generator" sub="Turn your PDFs into clean, exam-ready notes." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="select">
            <option>Short Notes</option><option>Long Notes</option>
            <option>Revision Notes</option><option>One-Day-Before-Exam Notes</option>
          </select>
        </Field>
        <Field label="Topic (optional)">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" className="select w-56" />
        </Field>
        <button onClick={generate} disabled={loading || !hasDocs}
          className="rounded-xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] px-5 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
          {loading ? "Generating…" : "✨ Generate"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-6">
        {!notes && !loading && <p className="text-sm text-[var(--text-faint)]">{hasDocs ? "Your generated notes will appear here…" : "Upload a PDF first to generate notes."}</p>}
        {loading && <p className="typing text-sm text-[var(--text-dim)]">Reading your material and writing notes…</p>}
        {notes && (
          <div className="prose-notes">
            <ReactMarkdown>{notes}</ReactMarkdown>
          </div>
        )}
      </div>
    </>
  );
}

/* ============ QUIZ ============ */
function QuizTab({ hasDocs }: { hasDocs: boolean }) {
  const [difficulty, setDifficulty] = useState("Medium");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<Quiz[]>([]);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setLoading(true); setErr(""); setQuestions([]); setPicked({});
    try {
      const res = await fetch("/api/quiz", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty, count }),
      });
      const data = await res.json();
      if (data.error) setErr(data.error);
      else setQuestions(data.questions || []);
    } catch { setErr("Something went wrong."); }
    setLoading(false);
  }

  const answered = Object.keys(picked).length;
  const score = questions.reduce((s, q, i) => s + (picked[i] === q.answer ? 1 : 0), 0);
  const done = questions.length > 0 && answered === questions.length;

  return (
    <>
      <Header title="📝 Quiz Generator" sub="Auto-generated MCQs from your material, graded instantly." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Difficulty">
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="select">
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </Field>
        <Field label="Questions">
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="select">
            <option value={3}>3</option><option value={5}>5</option><option value={8}>8</option>
          </select>
        </Field>
        <button onClick={generate} disabled={loading || !hasDocs}
          className="rounded-xl bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] px-5 py-2.5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
          {loading ? "Generating…" : "⚡ Generate Quiz"}
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {!questions.length && !loading && !err && (
          <p className="text-sm text-[var(--text-faint)]">{hasDocs ? "Generate a quiz to test yourself." : "Upload a PDF first to generate a quiz."}</p>
        )}
        {loading && <p className="typing text-sm text-[var(--text-dim)]">Writing questions from your material…</p>}
        {err && <p className="text-sm text-red-400">❌ {err}</p>}

        {done && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center">
            <div className="text-3xl font-bold grad-text">{Math.round((score / questions.length) * 100)}%</div>
            <p className="mt-1 text-sm">You scored <b>{score}/{questions.length}</b> {score === questions.length ? "🏆 Perfect!" : score >= questions.length * 0.6 ? "👍 Nice!" : "📚 Keep studying!"}</p>
          </div>
        )}

        {questions.map((q, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 font-medium">Q{i + 1}. {q.q}</div>
            <div className="space-y-2">
              {q.options.map((opt, j) => {
                const chosen = picked[i];
                const isAnswered = chosen !== undefined;
                let cls = "border-white/10 bg-white/5 hover:border-[var(--blue)]";
                if (isAnswered) {
                  if (j === q.answer) cls = "border-emerald-500 bg-emerald-500/15";
                  else if (j === chosen) cls = "border-red-500 bg-red-500/15";
                  else cls = "border-white/10 bg-white/5 opacity-60";
                }
                return (
                  <button key={j} disabled={isAnswered}
                    onClick={() => setPicked((p) => ({ ...p, [i]: j }))}
                    className={"block w-full rounded-lg border px-4 py-2.5 text-left text-sm transition " + cls}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {picked[i] !== undefined && (
              <p className="mt-3 text-xs text-[var(--text-dim)]">💡 {q.explanation}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ============ small shared bits ============ */
function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-[var(--text-dim)]">{sub}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--text-faint)]">{label}</span>
      {children}
    </label>
  );
}
