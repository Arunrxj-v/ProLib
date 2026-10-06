import {
  countDirectoryStudents,
  listStudents,
  searchStudents,
} from "@/lib/data/students";
import { apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 60;
const MAX_RESULTS = 8;
const MAX_PAGE_SIZE = 50;

/**
 * `GET /api/students` — the directory, straight from PostgreSQL.
 *
 *   ?q=arun               → typeahead shape `{ query, directoryCount, items }`
 *   ?q=&page=1&limit=20   → paginated shape (adds total/page/pageSize/…)
 *   ?department=cse        → filtered + paginated
 *
 * With zero users the answer is an empty `items` array and
 * `directoryCount: 0` — there is never fallback data of any kind.
 * Oversized queries are truncated, page sizes clamped.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH).trim();
  const department = searchParams.get("department")?.trim() || undefined;

  const paged =
    searchParams.has("page") ||
    searchParams.has("limit") ||
    searchParams.has("pageSize") ||
    Boolean(department);

  try {
    const directoryCount = await countDirectoryStudents();

    if (!paged) {
      // Legacy typeahead contract used by the team picker — unchanged.
      const items = await searchStudents(query, MAX_RESULTS);
      return Response.json({ query, directoryCount, items });
    }

    const rawPage = Number(searchParams.get("page") ?? "1");
    const rawLimit = Number(
      searchParams.get("limit") ?? searchParams.get("pageSize") ?? "",
    );
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : 12,
      ),
    );

    const result = await listStudents({
      q: query || undefined,
      department,
      page,
      pageSize,
    });

    return Response.json({
      query,
      directoryCount,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      pageCount: result.pageCount,
      items: result.items,
    });
  } catch (error) {
    console.error("student search failed", error);
    return apiError(500, "Internal Server Error", "Search is unavailable.");
  }
}
