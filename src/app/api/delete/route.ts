/* POST /api/delete — remove a file (and its vectors) from the library. */
import { removeFile, listFiles } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { file } = await request.json();
    if (!file || typeof file !== "string") {
      return Response.json({ error: "Missing file name." }, { status: 400 });
    }
    await removeFile(file);
    return Response.json({ ok: true, files: await listFiles() });
  } catch (err) {
    console.error("delete error:", err);
    return Response.json({ error: "Delete failed." }, { status: 500 });
  }
}
