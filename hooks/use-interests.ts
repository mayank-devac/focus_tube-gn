"use client"

import { useCallback, useMemo } from "react"

type InterestsData = {
  topics: Record<string, number>
  channels: Record<string, number>
  videos: Record<string, number>
  genres: Record<string, number>
  lastQueries: string[]
}

const STORAGE_KEY = "ft_interests_v1"

function read(): InterestsData {
  if (typeof window === "undefined") {
    return { topics: {}, channels: {}, videos: {}, genres: {}, lastQueries: [] }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { topics: {}, channels: {}, videos: {}, genres: {}, lastQueries: [] }
    const parsed = JSON.parse(raw)
    return {
      topics: parsed.topics || {},
      channels: parsed.channels || {},
      videos: parsed.videos || {},
      genres: parsed.genres || {},
      lastQueries: parsed.lastQueries || [],
    }
  } catch {
    return { topics: {}, channels: {}, videos: {}, genres: {}, lastQueries: [] }
  }
}

function write(data: InterestsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

// quick-and-simple genre inference from a title/query
function inferGenre(text: string) {
  const t = (text || "").toLowerCase()
  if (/\b(math|algebra|calculus|geometry|trig|probability)\b/.test(t)) return "math"
  if (/\b(physics|quantum|mechanics|thermo|electromagnetism)\b/.test(t)) return "physics"
  if (/\b(chemistry|organic|inorganic|stoichiometry)\b/.test(t)) return "chemistry"
  if (/\b(biology|bio|genetics|ecology|anatomy)\b/.test(t)) return "biology"
  if (/\b(cs|programming|code|coding|javascript|python|java|react|ai|ml)\b/.test(t)) return "programming"
  if (/\b(history|world war|ancient|medieval|renaissance)\b/.test(t)) return "history"
  if (/\b(economics|finance|micro|macro|accounting)\b/.test(t)) return "economics"
  if (/\b(literature|poetry|novel|essay)\b/.test(t)) return "literature"
  if (/\b(geography|earth|climate)\b/.test(t)) return "geography"
  return "general"
}

// Scoring: boost matches on channel, title tokens, inferred genre
export function scoreVideoForInterests(video: {
  id?: string
  title?: string
  channelTitle?: string
}) {
  if (typeof window === "undefined") return 0
  const data = read()
  const title = video.title || ""
  const channel = video.channelTitle || ""
  const genre = inferGenre(title)
  let score = 0

  // channel preference
  if (channel && data.channels[channel]) score += 5 * data.channels[channel]

  // title tokens overlap with topics
  const tokens = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  for (const tok of tokens) {
    if (data.topics[tok]) score += Math.min(3, data.topics[tok])
  }

  // genre boost
  if (data.genres[genre]) score += 2 * data.genres[genre]

  // seen before slight boost (if watched, but keep low to avoid repeats)
  if (video.id && data.videos[video.id]) score += 1

  return score
}

export function useInterests() {
  const recordSearch = useCallback((query: string) => {
    if (typeof window === "undefined" || !query) return
    const data = read()
    const q = query.toLowerCase()
    // store last 10 queries
    const last = [q, ...data.lastQueries.filter((x) => x !== q)].slice(0, 10)
    // count tokens as topics
    const tokens = q.split(/[^a-z0-9]+/).filter(Boolean)
    tokens.forEach((t) => {
      data.topics[t] = (data.topics[t] || 0) + 1
    })
    // inferred genre
    const g = inferGenre(q)
    data.genres[g] = (data.genres[g] || 0) + 1
    data.lastQueries = last
    write(data)
  }, [])

  const recordVideoClick = useCallback((args: { id?: string; title?: string; channelTitle?: string }) => {
    if (typeof window === "undefined") return
    const data = read()
    if (args.id) data.videos[args.id] = (data.videos[args.id] || 0) + 1
    if (args.channelTitle) {
      data.channels[args.channelTitle] = (data.channels[args.channelTitle] || 0) + 1
    }
    if (args.title) {
      const tokens = (args.title || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
      tokens.forEach((t) => {
        data.topics[t] = (data.topics[t] || 0) + 1
      })
      const g = inferGenre(args.title || "")
      data.genres[g] = (data.genres[g] || 0) + 1
    }
    write(data)
  }, [])

  const preferredQuery = useMemo(() => {
    if (typeof window === "undefined") return ""
    const data = read()
    // build a query from top 3 topics or fallback to education terms
    const top = Object.entries(data.topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k)
    return top.length ? top.join(" ") : "education science tutorial"
  }, [])

  return { recordSearch, recordVideoClick, preferredQuery, scoreVideoForInterests }
}
