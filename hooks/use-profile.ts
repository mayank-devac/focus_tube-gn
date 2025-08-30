"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

export type Profile = {
  name: string
  age?: number
  grade?: string // e.g., "K-12", "College", "Graduate", specific year/grade text
  role?: "learner" | "student" | "developer" | "teacher" | "researcher" | "journalist" | "other"
  work?: string // free text like "HS Student", "Frontend Dev", etc.
  interests: string[] // subjects/tags like math, music, etc.
  preferences: {
    focusModeDefault: boolean
    contentDepth: "short" | "balanced" | "deep"
    preferredTopicsHint?: string // used to bias queries or client-side ranking
  }
  updatedAt: number
}

const STORAGE_KEY = "focustube:profile"

const defaultProfile: Profile = {
  name: "",
  age: undefined,
  grade: undefined,
  role: "learner",
  work: "",
  interests: [],
  preferences: {
    focusModeDefault: true,
    contentDepth: "balanced",
    preferredTopicsHint: "",
  },
  updatedAt: Date.now(),
}

function safeParseProfile(v: unknown): Profile {
  try {
    if (!v || typeof v !== "string") return defaultProfile
    const parsed = JSON.parse(v as string)
    // very light structural guard
    return {
      ...defaultProfile,
      ...(parsed || {}),
      preferences: { ...defaultProfile.preferences, ...(parsed?.preferences || {}) },
      interests: Array.isArray(parsed?.interests) ? parsed.interests.filter(Boolean) : [],
      updatedAt: parsed?.updatedAt || Date.now(),
    }
  } catch {
    return defaultProfile
  }
}

export function useProfile() {
  const [profile, setProfileState] = useState<Profile>(defaultProfile)
  const [ready, setReady] = useState(false)

  // Load once from localStorage (client-only)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
      setProfileState(safeParseProfile(raw))
    } finally {
      setReady(true)
    }
  }, [])

  const setProfile = useCallback((next: Profile) => {
    const withTime = { ...next, updatedAt: Date.now() }
    setProfileState(withTime)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withTime))
      window.dispatchEvent(new CustomEvent("focustube:profile-updated", { detail: withTime }))
    } catch {
      // ignore storage errors
    }
  }, [])

  const updateProfile = useCallback(
    (partial: Partial<Profile>) => {
      setProfile({ ...profile, ...partial })
    },
    [profile, setProfile],
  )

  const updatePreferences = useCallback(
    (partial: Partial<Profile["preferences"]>) => {
      setProfile({ ...profile, preferences: { ...profile.preferences, ...partial } })
    },
    [profile, setProfile],
  )

  const addInterest = useCallback(
    (interest: string) => {
      const t = interest.trim()
      if (!t) return
      if (profile.interests.includes(t)) return
      setProfile({ ...profile, interests: [...profile.interests, t] })
    },
    [profile, setProfile],
  )

  const removeInterest = useCallback(
    (interest: string) => {
      setProfile({ ...profile, interests: profile.interests.filter((i) => i !== interest) })
    },
    [profile, setProfile],
  )

  const clearProfile = useCallback(() => {
    setProfile(defaultProfile)
  }, [setProfile])

  const preferredQuery = useMemo(() => {
    if (profile.preferences.preferredTopicsHint?.trim()) return profile.preferences.preferredTopicsHint!.trim()
    if (profile.interests.length) return profile.interests.slice(0, 3).join(" ")
    switch (profile.role) {
      case "student":
        return "study guide tutorial"
      case "developer":
        return "computer science algorithms data structures"
      case "teacher":
        return "lesson plan pedagogy classroom"
      case "researcher":
      case "journalist":
        return "research methods statistics analysis"
      default:
        return "educational learning"
    }
  }, [profile])

  return {
    ready,
    profile,
    setProfile,
    updateProfile,
    updatePreferences,
    addInterest,
    removeInterest,
    clearProfile,
    preferredQuery,
  }
}
