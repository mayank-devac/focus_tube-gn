import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { searchEducationalVideos, type Role, hasYouTubeApiKey, mostPopularEducationalVideos } from "@/lib/youtube"

const WINDOW_MS = 5_000 // 5 seconds
const LIMIT = 6 // max 6 requests per window per IP
const hits = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  const arr = hits.get(ip) || []
  const recent = arr.filter((t) => t > windowStart)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > LIMIT
}

export async function GET(req: NextRequest) {
  if (!hasYouTubeApiKey()) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY. Add it in Project Settings > Environment Variables." },
      { status: 500 },
    )
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    // next fallback: cf-connecting-ip or real ip if available
    req.headers.get("cf-connecting-ip") ||
    "anonymous"

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded. Please slow down." }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").trim()
  const roleParam = (searchParams.get("role") || "learner").toLowerCase()
  const allowedRoles = ["learner", "student", "developer", "teacher", "researcher", "journalist"] as const
  const role = (allowedRoles.includes(roleParam as any) ? roleParam : "learner") as Role
  const maxRaw = Number(searchParams.get("max") || 24)
  const max = Number.isFinite(maxRaw) ? Math.min(Math.max(6, maxRaw), 50) : 24
  const regionCode = (searchParams.get("region") || "US").toUpperCase()
  const pageToken = searchParams.get("pageToken")

  try {
    if (!q) {
      const { items, nextPageToken } = await mostPopularEducationalVideos({ max, role, regionCode, pageToken })
      const res = NextResponse.json({ items, nextPageToken })
      res.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120")
      return res
    }

    const { items, nextPageToken } = await searchEducationalVideos({ query: q, role, max, pageToken })
    if (items.length > 0) {
      const res = NextResponse.json({ items, nextPageToken })
      res.headers.set("Cache-Control", "private, max-age=20, stale-while-revalidate=60")
      return res
    }

    const fallback = await mostPopularEducationalVideos({ max, role, regionCode, pageToken: null })
    const res = NextResponse.json({ items: fallback.items, nextPageToken: fallback.nextPageToken })
    res.headers.set("Cache-Control", "private, max-age=20, stale-while-revalidate=60")
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Search failed" }, { status: 500 })
  }
}
