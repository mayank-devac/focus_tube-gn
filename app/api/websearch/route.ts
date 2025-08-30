import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") || ""
  if (!q.trim()) return Response.json({ results: [] })
  try {
    const [wiki, ddg] = await Promise.all([
      fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1&no_html=1`).then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
    const results: any[] = []
    if (wiki?.title && wiki?.extract) {
      results.push({
        source: "Wikipedia",
        title: wiki.title,
        url: wiki.content_urls?.desktop?.page || null,
        snippet: wiki.extract,
      })
    }
    if (ddg?.AbstractText) {
      results.push({
        source: "DuckDuckGo",
        title: ddg.Heading || q,
        url: ddg.AbstractURL || null,
        snippet: ddg.AbstractText,
      })
    }
    return Response.json({ results })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Web search failed" }), { status: 500 })
  }
}
