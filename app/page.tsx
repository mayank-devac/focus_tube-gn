"use client"

import useSWR from "swr"
import { useEffect, useState, useRef } from "react"
import { RoleSelector, type RoleId } from "@/components/role-selector"
import { SearchBar } from "@/components/search-bar"
import { VideoCard } from "@/components/video-card"
import { PomodoroTimer } from "@/components/pomodoro-timer"
import { useInterests } from "@/hooks/use-interests"

const CACHE_PREFIX = "focustube:search:"
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function readCache(url: string): { _ts: number; data: any } | null {
  try {
    if (typeof window === "undefined") return null
    const key = CACHE_PREFIX + url

    // Try sessionStorage first (session-scoped cache)
    const rawSession = sessionStorage.getItem(key)
    if (rawSession) {
      const parsed = JSON.parse(rawSession)
      if (parsed && typeof parsed._ts === "number" && "data" in parsed) return parsed
    }

    // Fallback to localStorage if nothing in sessionStorage
    const rawLocal = localStorage.getItem(key)
    if (!rawLocal) return null
    const parsedLocal = JSON.parse(rawLocal)
    if (!parsedLocal || typeof parsedLocal._ts !== "number" || !("data" in parsedLocal)) return null
    return parsedLocal
  } catch {
    return null
  }
}

function writeCache(url: string, data: any) {
  try {
    if (typeof window === "undefined") return
    const key = CACHE_PREFIX + url
    const payload = JSON.stringify({ _ts: Date.now(), data })
    try {
      sessionStorage.setItem(key, payload)
    } catch {
      // If sessionStorage quota fails, use localStorage as a fallback
      localStorage.setItem(key, payload)
    }
  } catch {
    // ignore quota or serialization errors
  }
}

const fetcher = async (url: string) => {
  const cached = readCache(url)
  if (cached && Date.now() - cached._ts < CACHE_TTL_MS) {
    return cached.data
  }
  const r = await fetch(url, { headers: { accept: "application/json" } })
  if (!r.ok) {
    const text = await r.text().catch(() => "")
    // stale-while-revalidate-ish: return cached data if available
    if (cached) return cached.data
    throw new Error(text || r.statusText || `Request failed (${r.status})`)
  }
  const json = await r.json()
  writeCache(url, json)
  return json
}

const SUBJECTS_BY_ROLE: Record<RoleId, string[]> = {
  learner: ["math", "science", "history", "study skills"],
  student: ["calculus", "physics", "chemistry", "study skills"],
  developer: ["data structures", "algorithms", "react", "python"],
  teacher: ["pedagogy", "classroom management", "assessment"],
  researcher: ["statistics", "machine learning", "literature review"],
  journalist: ["media ethics", "investigative reporting", "data journalism"],
}

const EXTRA_TOPICS = [
  "ai",
  "python",
  "economy",
  "trade",
  "news",
  "finance",
  "data science",
  "cybersecurity",
  "biology",
  "astronomy",
  "philosophy",
  "writing",
  "public speaking",
  "marketing",
  "web dev",
  "algebra",
  "geometry",
  "machine learning",
]

export default function HomePage() {
  const [role, setRole] = useState<RoleId>("learner")
  const [query, setQuery] = useState("")
  const [subject, setSubject] = useState<string | null>(null)
  const [items, setItems] = useState<any[]>([])
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const { recordSearch, scoreVideoForInterests } = useInterests()

  const [suggestions, setSuggestions] = useState<string[]>([])
  const pickRandom = (arr: string[], n: number) => {
    const copy = Array.from(new Set(arr)) // dedupe
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, Math.min(n, copy.length))
  }

  useEffect(() => {
    const base = SUBJECTS_BY_ROLE[role] || []
    // mix base + extras then shuffle; limit to ~10 chips
    const mixed = pickRandom([...base, ...EXTRA_TOPICS], 10)
    setSuggestions(mixed)
  }, [role])

  const [cacheBust, setCacheBust] = useState(0)

  const searchUrl = query.trim()
    ? `/api/search?q=${encodeURIComponent(query)}&role=${role}${cacheBust ? `&_cb=${cacheBust}` : ""}`
    : null

  const {
    data: searchData,
    isLoading: searchLoading,
    error: searchError,
    mutate: mutateSearch,
  } = useSWR(searchUrl, fetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  })

  const curatedUrl =
    !query && subject
      ? `/api/search?q=${encodeURIComponent(subject)}&role=${role}&max=12${cacheBust ? `&_cb=${cacheBust}` : ""}`
      : null

  const {
    data: curatedData,
    isLoading: curatedLoading,
    error: curatedError,
    mutate: mutateCurated,
  } = useSWR(curatedUrl, fetcher, {
    dedupingInterval: 60_000,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  })

  const makeUniqueById = (arr: any[]) => {
    const seen = new Set<string>()
    return arr.filter((x) => {
      const id = x?.id
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }

  useEffect(() => {
    const first = SUBJECTS_BY_ROLE[role]?.[0]
    setSubject(first || null)
  }, [role])

  useEffect(() => {
    if (query) recordSearch(query)
  }, [query, recordSearch])

  useEffect(() => {
    if (subject) recordSearch(subject)
  }, [subject, recordSearch])

  useEffect(() => {
    const base = query ? searchData : curatedData
    const baseItems = base?.items ?? []

    const scored = baseItems.map((v: any) => ({
      ...v,
      _score: scoreVideoForInterests({
        id: v?.id,
        title: v?.title,
        channelTitle: v?.channelTitle,
      }),
    }))
    scored.sort((a: any, b: any) => (b._score ?? 0) - (a._score ?? 0))

    setItems(makeUniqueById(scored))
    setNextToken(base?.nextPageToken ?? null)
  }, [query, subject, searchData, curatedData, scoreVideoForInterests])

  const handleReload = () => {
    setNextToken(null)
    setCacheBust(Date.now())
    if (searchUrl) void mutateSearch()
    if (curatedUrl) void mutateCurated()
  }

  const handleLoadMore = async () => {
    if (loadingMore) return
    const baseUrl = searchUrl || curatedUrl
    if (!baseUrl || !nextToken) return
    try {
      setLoadingMore(true)
      const moreUrl = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}pageToken=${encodeURIComponent(nextToken)}`
      const res = await fetch(moreUrl)
      const json = await res.json()
      const moreItems = json?.items ?? []
      setItems((prev) => {
        const existing = new Set(prev.map((x: any) => x?.id))
        const filtered = moreItems.filter((x: any) => x?.id && !existing.has(x.id))
        return makeUniqueById([...prev, ...filtered])
      })
      setNextToken(json?.nextPageToken ?? null)
    } catch (err) {
      console.log("[v0] Load more error:", (err as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !nextToken || searchLoading || curatedLoading || searchError || curatedError) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          void handleLoadMore()
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 },
    )

    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextToken, searchLoading, curatedLoading, searchError, curatedError]) // intentionally not depending on handleLoadMore to avoid re-creating observer each render

  const isLoading = (searchUrl && searchLoading) || (curatedUrl && curatedLoading)
  const hasError = searchError || curatedError
  const errorMessage = (searchError as any)?.message || (curatedError as any)?.message || "Error loading videos."

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-col items-start gap-4">
        <h1 className="text-balance text-2xl font-semibold">FocusTube — Learn without distractions</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Only educational content. No Shorts. Minimal UI. AI study assistant built-in.
        </p>
        <RoleSelector value={role} onChange={setRole} />
        <div className="mt-2">
          <PomodoroTimer />
        </div>
      </header>

      <section className="flex flex-col items-start gap-3">
        <SearchBar onSearch={setQuery} />
        {!query && (
          <div className="flex flex-wrap gap-2 text-sm">
            {(suggestions.length ? suggestions : SUBJECTS_BY_ROLE[role] || []).map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`rounded border px-2 py-1 ${subject === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            className="rounded px-3 py-1 text-sm hover:bg-muted rounded-4xl border-4"
            aria-label="Reload videos"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={!nextToken || loadingMore}
            className="rounded px-3 py-1 text-sm disabled:opacity-50 hover:bg-muted rounded-4xl border-4"
            aria-label="Load more videos"
          >
            {loadingMore ? "Loading…" : nextToken ? "Load more" : "No more"}
          </button>
        </div>
      </section>

      <section aria-label="Results" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {isLoading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className="col-span-1 animate-pulse rounded-md border p-3">
                <div className="h-32 rounded bg-muted/40" />
                <div className="mt-2 h-4 w-2/3 rounded bg-muted/30" />
                <div className="mt-1 h-3 w-1/2 rounded bg-muted/20" />
              </div>
            ))}
          </>
        )}

        {items.map((v: any, i: number) => (
          <VideoCard
            key={v.id ?? `v-${i}`}
            id={v.id}
            title={v.title}
            channelTitle={v.channelTitle}
            thumbnail={v.thumbnail}
            durationSec={v.durationSec}
          />
        ))}

        {/* sentinel for infinite scroll */}
        <div ref={sentinelRef} className="col-span-full h-px" aria-hidden="true" />

        {loadingMore && (
          <div className="col-span-full text-sm text-muted-foreground" aria-live="polite">
            Loading more…
          </div>
        )}

        {!items.length && !isLoading && !hasError && (
          <div className="col-span-full rounded-md border p-4">
            <div className="text-sm text-muted-foreground">No results. Try a different query or subject.</div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={handleReload} className="rounded border px-3 py-1 text-sm hover:bg-muted">
                Reload
              </button>
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={!nextToken || loadingMore}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50 hover:bg-muted"
              >
                {loadingMore ? "Loading…" : nextToken ? "Load more" : "No more"}
              </button>
            </div>
          </div>
        )}

        {hasError && (
          <div className="col-span-full rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <div className="text-sm text-destructive" role="alert" aria-live="polite">
              {errorMessage}
            </div>
            <div className="mt-2">
              <button
                type="button"
                onClick={handleReload}
                className="rounded border px-3 py-1 text-sm hover:bg-muted"
                aria-label="Retry loading videos"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
