const YT_BASE = "https://www.googleapis.com/youtube/v3"

type SearchParams = {
  q?: string
  maxResults?: number
  pageToken?: string
  duration?: "short" | "medium" | "long" | "any"
}

type NormalizedVideo = {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  durationSec: number
  categoryId?: string
}

const cache = new Map<string, { expires: number; data: any }>()
function getCache<T>(key: string): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expires) {
    cache.delete(key)
    return null
  }
  return hit.data as T
}
function setCache<T>(key: string, data: T, ttlMs = 60_000) {
  cache.set(key, { data, expires: Date.now() + ttlMs })
}

export function parseISODurationToSeconds(iso?: string): number {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  const h = Number.parseInt(m[1] || "0", 10)
  const mm = Number.parseInt(m[2] || "0", 10)
  const s = Number.parseInt(m[3] || "0", 10)
  return h * 3600 + mm * 60 + s
}

function keyFor(path: string, params: Record<string, string | number | undefined>) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&")
  return `${path}?${q}`
}

async function ytFetch<T>(path: string, params: Record<string, any>, ttlMs = 60_000): Promise<T> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    throw new Error("Missing YOUTUBE_API_KEY")
  }
  const finalParams: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      finalParams[k] = String(v)
    }
  }
  finalParams.key = apiKey

  const cacheKey = keyFor(path, finalParams)
  const hit = getCache<T>(cacheKey)
  if (hit) return hit

  const url = new URL(`${YT_BASE}/${path}`)
  url.search = new URLSearchParams(finalParams).toString()

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    // NOTE: keep server-only; you can also add { next: { revalidate: 60 } } if desired
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`YouTube API ${path} error ${res.status}: ${text || res.statusText}`)
  }
  const data = (await res.json()) as T
  setCache(cacheKey, data, ttlMs)
  return data
}

export async function searchVideoIds({ q, maxResults = 24, pageToken, duration = "any" }: SearchParams) {
  // Keep fields minimal: ids and nextPageToken only
  type SearchListResp = { nextPageToken?: string; items: { id: { videoId: string } }[] }
  const data = await ytFetch<SearchListResp>(
    "search",
    {
      part: "id",
      type: "video",
      q: q || undefined,
      videoEmbeddable: "true",
      safeSearch: "strict",
      maxResults: Math.min(Math.max(maxResults, 1), 50),
      pageToken,
      videoDuration: duration === "any" ? undefined : duration,
      // Only nextPageToken and id.videoId
      fields: "nextPageToken,items(id/videoId)",
    },
    60_000,
  )
  const ids = (data.items || []).map((i) => i?.id?.videoId).filter(Boolean) as string[]
  return { ids, nextPageToken: data.nextPageToken }
}

export async function getVideoDetails(ids: string[]): Promise<NormalizedVideo[]> {
  if (!ids.length) return []
  // Request only fields we render: title, channelTitle, thumbnails, categoryId, duration
  type VideosListResp = {
    items: {
      id: string
      snippet?: {
        title?: string
        channelTitle?: string
        categoryId?: string
        thumbnails?: {
          high?: { url: string }
          medium?: { url: string }
          default?: { url: string }
        }
      }
      contentDetails?: { duration?: string }
    }[]
  }
  const data = await ytFetch<VideosListResp>(
    "videos",
    {
      part: "snippet,contentDetails",
      id: ids.join(","),
      // Limit fields to reduce payload/quota
      fields:
        "items(id,snippet(title,channelTitle,categoryId,thumbnails(high,medium,default)),contentDetails(duration))",
    },
    60_000,
  )

  return (data.items || []).map((v) => {
    const thumb =
      v.snippet?.thumbnails?.high?.url ||
      v.snippet?.thumbnails?.medium?.url ||
      v.snippet?.thumbnails?.default?.url ||
      ""
    return {
      id: v.id,
      title: v.snippet?.title || "",
      channelTitle: v.snippet?.channelTitle || "",
      thumbnail: thumb,
      durationSec: parseISODurationToSeconds(v.contentDetails?.duration),
      categoryId: v.snippet?.categoryId,
    }
  })
}

export async function mostPopularEducational({
  maxResults = 24,
  pageToken,
  categoryIds = ["27", "28"],
}: {
  maxResults?: number
  pageToken?: string
  categoryIds?: string[]
}) {
  type VideosListResp = {
    nextPageToken?: string
    items: {
      id: string
      snippet?: {
        title?: string
        channelTitle?: string
        categoryId?: string
        thumbnails?: {
          high?: { url: string }
          medium?: { url: string }
          default?: { url: string }
        }
      }
      contentDetails?: { duration?: string }
    }[]
  }

  // Fetch per category and merge (batching)
  const chunks = await Promise.all(
    categoryIds.map((cat) =>
      ytFetch<VideosListResp>(
        "videos",
        {
          chart: "mostPopular",
          videoCategoryId: cat,
          part: "snippet,contentDetails",
          maxResults: Math.min(Math.max(maxResults, 1), 50),
          pageToken,
          fields:
            "nextPageToken,items(id,snippet(title,channelTitle,categoryId,thumbnails(high,medium,default)),contentDetails(duration))",
        },
        60_000,
      ).catch(() => ({ items: [] as any[], nextPageToken: undefined })),
    ),
  )

  const merged = chunks.flatMap((c) => c.items || [])
  const seen = new Set<string>()
  const unique = merged.filter((v) => (v?.id && !seen.has(v.id) ? (seen.add(v.id), true) : false))
  const results: NormalizedVideo[] = unique.map((v) => {
    const thumb =
      v.snippet?.thumbnails?.high?.url ||
      v.snippet?.thumbnails?.medium?.url ||
      v.snippet?.thumbnails?.default?.url ||
      ""
    return {
      id: v.id,
      title: v.snippet?.title || "",
      channelTitle: v.snippet?.channelTitle || "",
      thumbnail: thumb,
      durationSec: parseISODurationToSeconds(v.contentDetails?.duration),
      categoryId: v.snippet?.categoryId,
    }
  })

  // pageToken from multiple categories is ambiguous; omit for fallback (client can still load more via search)
  return { results, nextPageToken: undefined as string | undefined }
}

const JUNK_RE = /(prank|reaction|challenge|trailer|teaser|official video|music video|vlog)/i
export function filterEducational(items: NormalizedVideo[]) {
  return items.filter((v) => v.durationSec >= 120 && !JUNK_RE.test(v.title))
}
