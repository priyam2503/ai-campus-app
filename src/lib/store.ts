/* =========================================================
   Data layer for RAG. Two backends behind one async API:
   • Upstash Vector  — used when UPSTASH_VECTOR_REST_URL +
     UPSTASH_VECTOR_REST_TOKEN are set (works on Vercel).
   • Local file      — fallback for `npm run dev` with no
     Upstash keys (.data/store.json).
   ========================================================= */
import fs from "fs";
import path from "path";
import { Index } from "@upstash/vector";

export type ChunkMeta = { file: string; index: number; text: string };

const USE_UPSTASH = !!(process.env.UPSTASH_VECTOR_REST_URL && process.env.UPSTASH_VECTOR_REST_TOKEN);

export function backendName() {
  return USE_UPSTASH ? "Upstash Vector (cloud)" : "local file";
}

/* ---------------- Upstash backend ---------------- */
let _index: Index | null = null;
function idx(): Index {
  if (!_index) {
    _index = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL!,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
    });
  }
  return _index;
}

/* ---------------- Local backend ---------------- */
type LocalChunk = { id: string; file: string; index: number; text: string; embedding: number[] };
const g = globalThis as unknown as { __store?: LocalChunk[]; __loaded?: boolean };
const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "store.json");

if (!g.__store) g.__store = [];
if (!g.__loaded) {
  g.__loaded = true;
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
      if (Array.isArray(raw.chunks)) g.__store = raw.chunks;
    }
  } catch (e) {
    console.error("local store load failed:", e);
  }
}
const local = g.__store!;
function persistLocal() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ chunks: local }));
  } catch (e) {
    console.error("local persist failed:", e);
  }
}
function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/* ---------------- Pure helper ---------------- */
export function chunkText(text: string, size = 1000, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  const step = size - overlap;
  for (let i = 0; i < clean.length; i += step) {
    chunks.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
  }
  return chunks.filter((c) => c.trim().length > 20);
}

/* ---------------- Public async API ---------------- */

/** Add a file's chunks (replacing any previous version of the same file). */
export async function addChunks(file: string, items: { text: string; embedding: number[] }[]): Promise<void> {
  await removeFile(file);
  if (USE_UPSTASH) {
    const vectors = items.map((it, i) => ({
      id: `${file}::${i}`,
      vector: it.embedding,
      metadata: { file, index: i, text: it.text },
    }));
    const BATCH = 50;
    for (let i = 0; i < vectors.length; i += BATCH) {
      await idx().upsert(vectors.slice(i, i + BATCH));
    }
  } else {
    items.forEach((it, i) => local.push({ id: `${file}::${i}`, file, index: i, text: it.text, embedding: it.embedding }));
    persistLocal();
  }
}

/** Retrieve the top-K most relevant chunks for a query embedding. */
export async function searchChunks(embedding: number[], k: number): Promise<ChunkMeta[]> {
  if (USE_UPSTASH) {
    const res = await idx().query({ vector: embedding, topK: k, includeMetadata: true });
    return res.map((r) => r.metadata as ChunkMeta | undefined).filter((m): m is ChunkMeta => !!m);
  }
  return local
    .map((c) => ({ c, s: cosine(embedding, c.embedding) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => ({ file: x.c.file, index: x.c.index, text: x.c.text }));
}

/** Grab a broad sample of chunks (used for notes/quiz over the whole document). */
export async function sampleChunks(n: number): Promise<ChunkMeta[]> {
  if (USE_UPSTASH) {
    const res = await idx().range({ cursor: 0, limit: n, includeMetadata: true });
    return res.vectors.map((v) => v.metadata as ChunkMeta | undefined).filter((m): m is ChunkMeta => !!m);
  }
  return local.slice(0, n).map((c) => ({ file: c.file, index: c.index, text: c.text }));
}

/** Remove a file and all its chunks. */
export async function removeFile(file: string): Promise<void> {
  if (USE_UPSTASH) {
    try { await idx().delete({ prefix: `${file}::` }); } catch { /* nothing to delete */ }
  } else {
    for (let i = local.length - 1; i >= 0; i--) if (local[i].file === file) local.splice(i, 1);
    persistLocal();
  }
}

/** List indexed files with their chunk counts. */
export async function listFiles(): Promise<{ file: string; chunks: number }[]> {
  const map = new Map<string, number>();
  if (USE_UPSTASH) {
    let cursor = "0";
    let guard = 0;
    do {
      const res = (await idx().range({ cursor, limit: 100, includeMetadata: true })) as {
        nextCursor: string;
        vectors: { metadata?: ChunkMeta }[];
      };
      for (const v of res.vectors) {
        const f = v.metadata?.file;
        if (f) map.set(f, (map.get(f) || 0) + 1);
      }
      cursor = res.nextCursor;
      guard++;
    } while (cursor && cursor !== "0" && cursor !== "" && guard < 100);
  } else {
    for (const c of local) map.set(c.file, (map.get(c.file) || 0) + 1);
  }
  return [...map.entries()].map(([file, chunks]) => ({ file, chunks }));
}

/** Cheap check for whether any documents exist. */
export async function isEmpty(): Promise<boolean> {
  if (USE_UPSTASH) {
    const res = await idx().range({ cursor: 0, limit: 1, includeMetadata: false });
    return res.vectors.length === 0;
  }
  return local.length === 0;
}
