import { NextResponse } from "next/server"
import { searchVideoIds, getVideoDetails, filterEducational, mostPopularEducational } from "@/lib/youtube-client"

const windowMs = 10_000
const maxRequests = 20 // tune as needed; keep well below user-based quota limits
const buckets = new Map<string, number[]>()

function allow(ip: string) {
  const now = Date.now()
  const arr = buckets.get(ip) || []
  const next = arr.filter((t) => now - t < windowMs)
  next.push(now)
  buckets.set(ip, next)
  return next.length <= maxRequests
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") || ""
  const pageToken = searchParams.get("pageToken") || undefined
  const max = Math.min(Math.max(Number(searchParams.get("max") || 24), 1), 50)
  const duration = (searchParams.get("duration") || "any") as "short" | "medium" | "long" | "any"

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY. Set it in Project Settings > Environment Variables." },
      { status: 500 },
    )
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || (req as any).ip || "anon"
  if (!allow(ip)) {
    return NextResponse.json({ error: "Too many requests, please slow down." }, { status: 429 })
  }

  try {
    let results
    let nextToken: string | undefined

    if (q) {
      // 1) cheap search for ids (search.list)
      const { ids, nextPageToken } = await searchVideoIds({ q, maxResults: max, pageToken, duration })

      // 2) batch fetch details for those ids (videos.list)
      const details = await getVideoDetails(ids)
      // 3) filter distractions and shorts
      results = filterEducational(details)
      nextToken = nextPageToken
    } else {
      // curated fallback feed if no query
      const popular = await mostPopularEducational({ maxResults: max, pageToken })
      results = filterEducational(popular.results)
      nextToken = popular.nextPageToken
    }

    const seen = new Set<string>()
    const unique = results.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)))

    // cache-friendly response
    const res = NextResponse.json({ results: unique, nextPageToken: nextToken ?? null }, { status: 200 })
    res.headers.set("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120")
    return res
  } catch (err: any) {
    const message = err?.message || "Unknown error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
