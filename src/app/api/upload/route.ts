/* POST /api/upload — accept a PDF, extract text, chunk, embed, store. */
import { extractText, getDocumentProxy } from "unpdf";
import { embed, hasKey, friendlyError } from "@/lib/gemini";
import { chunkText, addChunks, listFiles } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60; // allow up to 60s on Vercel for embedding many chunks

// Cap how many chunks we embed per file to stay within the free tier.
const MAX_CHUNKS = 40;

export async function POST(request: Request) {
  try {
    if (!hasKey()) {
      return Response.json(
        { error: "No Gemini API key. Add GEMINI_API_KEY to .env.local (see README)." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return Response.json({ error: "No file uploaded." }, { status: 400 });
    }

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(data);
    const parsed = await extractText(pdf, { mergePages: true });
    const text = parsed.text || "";
    if (text.trim().length < 30) {
      return Response.json(
        { error: "Could not read text from this PDF (it may be a scanned image)." },
        { status: 422 }
      );
    }

    let chunks = chunkText(text);
    if (chunks.length > MAX_CHUNKS) chunks = chunks.slice(0, MAX_CHUNKS);

    const items: { text: string; embedding: number[] }[] = [];
    for (const c of chunks) {
      items.push({ text: c, embedding: await embed(c) });
    }
    await addChunks(file.name, items);

    return Response.json({
      ok: true,
      file: file.name,
      chunks: items.length,
      pages: parsed.totalPages,
      files: await listFiles(),
    });
  } catch (err) {
    console.error("upload error:", err);
    return Response.json({ error: friendlyError(err) }, { status: 500 });
  }
}

// GET /api/upload — list indexed files (used by the UI on load).
export async function GET() {
  try {
    return Response.json({ files: await listFiles() });
  } catch (err) {
    console.error("list error:", err);
    return Response.json({ files: [] });
  }
}
