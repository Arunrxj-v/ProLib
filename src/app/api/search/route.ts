import { searchPreview } from "@/lib/data/search";

/** Never cached — the palette hits this on every keystroke. */
export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const query = raw.trim();

  if (!query) {
    return Response.json({ query: "", total: 0, groups: [] });
  }

  try {
    return Response.json(await searchPreview(query));
  } catch (error) {
    console.error("search preview failed", error);
    return Response.json(
      { error: "Service Unavailable", message: "Search is unavailable." },
      { status: 503 },
    );
  }
}
