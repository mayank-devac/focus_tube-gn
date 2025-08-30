const YT_BASE = "https://www.googleapis.com/youtube/v3"

export type Role = "student" | "developer" | "teacher" | "researcher" | "journalist" | "learner"

export type VideoItem = {
  id: string
  title: string
  description: string
  channelTitle: string
  channelId: string
  thumbnail: string
  publishedAt: string
  durationSec: number
  categoryId: string
}

export type Paged<T> = { items: T[]; nextPageToken?: string | null }

const ALLOWED_CATEGORY_IDS = new Set(["27", "28", "26"]) // Education, Science & Tech, Howto & Style
const BLOCK_KEYWORDS = [
  "prank",
  "celebrity",
  "asmr",
  "vlog",
  "reaction",
  "trailer",
  "music video",
  "lyrics",
  "official video",
  "clip",
  "funny",
  "challenge",
  "gossip",
  "rumor",
  "meme",
  "shorts",
]

const ROLE_CHANNEL_ALLOWLIST: Record<Role, string[]> = {
  student: ["Khan Academy", "MIT OpenCourseWare", "3Blue1Brown", "CrashCourse", "Veritasium", "Numberphile"],
  developer: [
    "freeCodeCamp.org",
    "Fireship",
    "Traversy Media",
    "CS Dojo",
    "Corey Schafer",
    "The Net Ninja",
    "Programming with Mosh",
    "Tech with Tim",
  ],
  teacher: ["Edutopia", "Cult of Pedagogy", "TeacherToolkit", "Common Sense Education"],
  researcher: ["MIT OpenCourseWare", "Stanford", "Microsoft Research", "Google Research"],
  journalist: ["Knight Center for Journalism", "Reuters Institute", "Columbia Journalism School"],
  learner: ["Khan Academy", "MIT OpenCourseWare", "CrashCourse", "freeCodeCamp.org", "3Blue1Brown", "Veritasium"],
}

function isoDurationToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = Number.parseInt(match[1] || "0", 10)
  const m = Number.parseInt(match[2] || "0", 10)
  const s = Number.parseInt(match[3] || "0", 10)
  return h * 3600 + m * 60 + s
}

function looksBlockedByKeyword(s: string) {
  const lower = s.toLowerCase()
  return BLOCK_KEYWORDS.some((k) => lower.includes(k))
}

function scoreVideoForRole(v: VideoItem, role: Role): number {
  let score = 0
  if (ALLOWED_CATEGORY_IDS.has(v.categoryId)) score += 5
  if (v.durationSec >= 6 * 60 && v.durationSec <= 45 * 60) score += 2
  const allow = ROLE_CHANNEL_ALLOWLIST[role] || []
  if (allow.some((name) => v.channelTitle.toLowerCase().includes(name.toLowerCase()))) score += 6
  if (looksBlockedByKeyword(v.title) || looksBlockedByKeyword(v.description)) score -= 4
  return score
}

function normalizeVideoItem(i: any): VideoItem {
  const dur = isoDurationToSeconds(i?.contentDetails?.duration || "PT0S")
  return {
    id: i.id,
    title: i?.snippet?.title || "",
    description: i?.snippet?.description || "",
    channelTitle: i?.snippet?.channelTitle || "",
    channelId: i?.snippet?.channelId || "",
    thumbnail: i?.snippet?.thumbnails?.medium?.url || i?.snippet?.thumbnails?.default?.url || "",
    publishedAt: i?.snippet?.publishedAt || "",
    durationSec: dur,
    categoryId: i?.snippet?.categoryId || "",
  }
}

const TTL_MS = 5 * 60 * 1000 // 5 minutes
type CacheEntry<T> = { value: T; expiresAt: number }
const searchIdsCache = new Map<string, CacheEntry<{ ids: string[]; nextPageToken?: string | null }>>()
const videoDetailsCache = new Map<string, CacheEntry<VideoItem[]>>() // key is sorted id list
const popularCache = new Map<string, CacheEntry<Paged<VideoItem>>>()

function now() {
  return Date.now()
}
function setCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttl = TTL_MS) {
  map.set(key, { value, expiresAt: now() + ttl })
}
function getCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key)
  if (!hit) return null
  if (hit.expiresAt < now()) {
    map.delete(key)
    return null
  }
  return hit.value
}

function baseParams(params: Record<string, string | number | undefined>) {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.set(k, String(v))
  }
  return usp.toString()
}

// Helper to detect if the YT API key is available on server
export function hasYouTubeApiKey(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY)
}

async function ytFetch(path: string, params: Record<string, string | number | undefined>, fields?: string) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error("Missing YOUTUBE_API_KEY. Add it in Project Settings > Environment Variables.")
  const qs = baseParams({ key, ...params, ...(fields ? { fields } : {}) })
  const res = await fetch(`${YT_BASE}${path}?${qs}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube API error: ${res.status} ${text}`)
  }
  return res.json()
}

async function fetchSearchIds(
  query: string,
  max: number,
  pageToken?: string | null,
): Promise<{ ids: string[]; nextPageToken?: string | null }> {
  const cacheKey = JSON.stringify({ t: "searchIds", q: query, max, pageToken })
  const cached = getCache(searchIdsCache, cacheKey)
  if (cached) return cached

  const search = await ytFetch(
    "/search",
    {
      part: "snippet", // minimal, we only need ids here
      q: query,
      type: "video",
      maxResults: Math.min(max, 50),
      safeSearch: "strict",
      videoEmbeddable: "true",
      order: "relevance",
      pageToken: pageToken || undefined,
    },
    // minimal response shape
    "nextPageToken,items(id/videoId)",
  )

  const ids: string[] = (search.items || []).map((i: any) => i?.id?.videoId).filter(Boolean)
  const value = { ids, nextPageToken: search?.nextPageToken || null }
  setCache(searchIdsCache, cacheKey, value)
  return value
}

async function fetchVideoDetails(ids: string[]): Promise<VideoItem[]> {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) return []
  const key = JSON.stringify({ t: "details", ids: uniqueIds.slice().sort() })
  const cached = getCache(videoDetailsCache, key)
  if (cached) return cached

  const details = await ytFetch(
    "/videos",
    {
      part: "snippet,contentDetails",
      id: uniqueIds.join(","),
      // note: maxResults is not used for id-based videos.list; omit to be precise
    },
    // minimal fields we actually use
    "items(id,snippet(title,description,channelTitle,channelId,categoryId,thumbnails/medium/url,thumbnails/default/url,publishedAt),contentDetails/duration)",
  )

  const items: VideoItem[] = (details.items || []).map((i: any) => normalizeVideoItem(i))
  setCache(videoDetailsCache, key, items)
  return items
}

export async function searchEducationalVideos({
  query,
  max = 24,
  role = "learner",
  pageToken,
}: {
  query: string
  max?: number
  role?: Role
  pageToken?: string | null
}): Promise<Paged<VideoItem>> {
  const { ids, nextPageToken } = await fetchSearchIds(query, max, pageToken)

  if (!ids.length) {
    return { items: [], nextPageToken }
  }

  const itemsRaw = await fetchVideoDetails(ids)

  const filtered = itemsRaw
    .filter((v) => v.durationSec >= 120) // block shorts-like content
    .filter((v) => ALLOWED_CATEGORY_IDS.has(v.categoryId))
    .filter((v) => !looksBlockedByKeyword(v.title) && !looksBlockedByKeyword(v.description))

  // de-dupe by id to avoid duplicate keys in UI
  const seen = new Set<string>()
  const deduped = filtered.filter((v) => {
    if (seen.has(v.id)) return false
    seen.add(v.id)
    return true
  })

  const scored = deduped
    .map((v) => ({ v, s: scoreVideoForRole(v, role) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v)

  return { items: scored, nextPageToken }
}

export async function mostPopularEducationalVideos({
  max = 24,
  role = "learner",
  regionCode = "US",
  pageToken,
}: {
  max?: number
  role?: Role
  regionCode?: string
  pageToken?: string | null
}): Promise<Paged<VideoItem>> {
  const cacheKey = JSON.stringify({ t: "popular", max, role, regionCode, pageToken })
  const cached = getCache(popularCache, cacheKey)
  if (cached) return cached

  const resp = await ytFetch(
    "/videos",
    {
      part: "snippet,contentDetails",
      chart: "mostPopular",
      videoCategoryId: "27", // Education
      regionCode,
      maxResults: Math.min(max, 50),
      pageToken: pageToken || undefined,
    },
    "nextPageToken,items(id,snippet(title,description,channelTitle,channelId,categoryId,thumbnails/medium/url,thumbnails/default/url,publishedAt),contentDetails/duration)",
  )

  const itemsRaw: VideoItem[] = (resp.items || []).map((i: any) => normalizeVideoItem(i))

  const filtered = itemsRaw
    .filter((v) => v.durationSec >= 120)
    .filter((v) => ALLOWED_CATEGORY_IDS.has(v.categoryId))
    .filter((v) => !looksBlockedByKeyword(v.title) && !looksBlockedByKeyword(v.description))

  const seen = new Set<string>()
  const deduped = filtered.filter((v) => {
    if (seen.has(v.id)) return false
    seen.add(v.id)
    return true
  })

  const scored = deduped
    .map((v) => ({ v, s: scoreVideoForRole(v, role) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v)

  const value: Paged<VideoItem> = { items: scored.slice(0, max), nextPageToken: resp?.nextPageToken || null }
  setCache(popularCache, cacheKey, value)
  return value
}

export async function getVideoDetails(id: string): Promise<VideoItem | null> {
  const details = await ytFetch("/videos", {
    part: "snippet,contentDetails,statistics",
    id,
    maxResults: 1,
  })
  const i = details.items?.[0]
  if (!i) return null
  return {
    id: i.id,
    title: i?.snippet?.title || "",
    description: i?.snippet?.description || "",
    channelTitle: i?.snippet?.channelTitle || "",
    channelId: i?.snippet?.channelId || "",
    thumbnail: i?.snippet?.thumbnails?.high?.url || "",
    publishedAt: i?.snippet?.publishedAt || "",
    durationSec: isoDurationToSeconds(i?.contentDetails?.duration || "PT0S"),
    categoryId: i?.snippet?.categoryId || "",
  }
}
