"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useProfile } from "@/hooks/use-profile"

const PRESET_INTERESTS = [
  "Math",
  "Algebra",
  "Geometry",
  "Calculus",
  "Physics",
  "Chemistry",
  "Biology",
  "Science",
  "Computer Science",
  "Programming",
  "Web Dev",
  "Data Structures",
  "Algorithms",
  "History",
  "Geography",
  "Economics",
  "Finance",
  "Business",
  "English",
  "Writing",
  "Languages",
  "Spanish",
  "French",
  "Chinese",
  "Music",
  "Art",
  "Design",
  "Psychology",
  "Philosophy",
]

export default function WelcomePage() {
  const router = useRouter()
  const { ready, profile, updateProfile, updatePreferences, addInterest, removeInterest, setProfile, preferredQuery } =
    useProfile()

  const [name, setName] = useState(profile.name)
  const [age, setAge] = useState<string>(profile.age ? String(profile.age) : "")
  const [grade, setGrade] = useState(profile.grade || "")
  const [role, setRole] = useState(profile.role || "learner")
  const [work, setWork] = useState(profile.work || "")
  const [customInterest, setCustomInterest] = useState("")
  const [focusModeDefault, setFocusModeDefault] = useState(profile.preferences.focusModeDefault)
  const [contentDepth, setContentDepth] = useState(profile.preferences.contentDepth)
  const [topicsHint, setTopicsHint] = useState(profile.preferences.preferredTopicsHint || "")

  useEffect(() => {
    if (!ready) return
    setName(profile.name)
    setAge(profile.age ? String(profile.age) : "")
    setGrade(profile.grade || "")
    setRole(profile.role || "learner")
    setWork(profile.work || "")
    setFocusModeDefault(profile.preferences.focusModeDefault)
    setContentDepth(profile.preferences.contentDepth)
    setTopicsHint(profile.preferences.preferredTopicsHint || "")
  }, [ready, profile])

  const selectedInterests = profile.interests

  function toggleInterest(tag: string) {
    if (selectedInterests.includes(tag)) removeInterest(tag)
    else addInterest(tag)
  }

  function handleAddCustomInterest() {
    const t = customInterest.trim()
    if (!t) return
    addInterest(t)
    setCustomInterest("")
  }

  function handleSave() {
    const parsedAge = age ? Math.max(3, Math.min(100, Number(age))) : undefined
    setProfile({
      ...profile,
      name: name.trim(),
      age: parsedAge && Number.isFinite(parsedAge) ? parsedAge : undefined,
      grade: grade.trim() || undefined,
      role: (role as any) || "learner",
      work: work.trim(),
      preferences: {
        ...profile.preferences,
        focusModeDefault,
        contentDepth,
        preferredTopicsHint: topicsHint.trim(),
      },
    })
  }

  function handleSaveAndContinue() {
    handleSave()
    router.push("/")
  }

  const interestHelp = useMemo(() => {
    return topicsHint?.trim() ? topicsHint.trim() : selectedInterests.slice(0, 5).join(", ")
  }, [topicsHint, selectedInterests])

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 md:py-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-balance text-2xl font-semibold">Welcome — Configure Your Study Experience</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          Tell us a bit about you. We’ll tailor the home feed, suggestions, and focus defaults to your goals.
        </p>
      </header>

      {/* Identity card */}
      <section className="mb-6 rounded-md border p-4">
        <h2 className="mb-3 text-base font-medium">Basic Info</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Name</span>
            <input
              className="rounded-md border bg-background px-3 py-2 outline-none"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Age</span>
            <input
              type="number"
              min={3}
              max={100}
              className="rounded-md border bg-background px-3 py-2 outline-none"
              placeholder="e.g., 16"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Grade / Level</span>
            <input
              className="rounded-md border bg-background px-3 py-2 outline-none"
              placeholder="e.g., Grade 10, College, Graduate"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Role / Work</span>
            <select
              className="rounded-md border bg-background px-3 py-2 outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="learner">Learner</option>
              <option value="student">Student</option>
              <option value="developer">Developer</option>
              <option value="teacher">Teacher</option>
              <option value="researcher">Researcher</option>
              <option value="journalist">Journalist</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="md:col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Work / Notes (optional)</span>
            <input
              className="rounded-md border bg-background px-3 py-2 outline-none"
              placeholder="e.g., HS Student, Frontend Dev, Physics teacher"
              value={work}
              onChange={(e) => setWork(e.target.value)}
            />
          </label>
        </div>
      </section>

      {/* Interests card */}
      <section className="mb-6 rounded-md border p-4">
        <h2 className="mb-3 text-base font-medium">Interests</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Select subjects you’re into. We’ll prioritize content matching these.
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {PRESET_INTERESTS.map((tag) => {
            const active = selectedInterests.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleInterest(tag)}
                className={`rounded-full border px-3 py-1 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
                aria-pressed={active}
              >
                {tag}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 outline-none"
            placeholder="Add a custom interest (e.g., Linear Algebra)"
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAddCustomInterest()
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddCustomInterest}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            Add
          </button>
        </div>
      </section>

      {/* Preferences card */}
      <section className="mb-6 rounded-md border p-4">
        <h2 className="mb-3 text-base font-medium">Preferences</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={focusModeDefault} onChange={(e) => setFocusModeDefault(e.target.checked)} />
            <span className="text-sm">Enable Focus Mode by default</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Content depth</span>
            <select
              className="rounded-md border bg-background px-3 py-2 outline-none"
              value={contentDepth}
              onChange={(e) => setContentDepth(e.target.value as any)}
            >
              <option value="short">Short/concise</option>
              <option value="balanced">Balanced</option>
              <option value="deep">Deep/long-form</option>
            </select>
          </label>

          <label className="md:col-span-2 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Preferred topics hint (optional)</span>
            <input
              className="rounded-md border bg-background px-3 py-2 outline-none"
              placeholder="e.g., calculus proofs, astronauts, classical mechanics"
              value={topicsHint}
              onChange={(e) => setTopicsHint(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Used to bias search and re-rank results. Current derived hint: {preferredQuery || "—"}
            </span>
          </label>
        </div>
      </section>

      {/* Actions */}
      <section className="flex items-center gap-3">
        <button type="button" onClick={handleSave} className="rounded-md border bg-background px-4 py-2 text-sm">
          Save
        </button>
        <button
          type="button"
          onClick={handleSaveAndContinue}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Save & Continue
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="ml-auto rounded-md border bg-background px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </section>

      <footer className="mt-6 text-xs text-muted-foreground">
        Your selections are stored locally in your browser and used to adjust suggestions, defaults, and re-ranking. You
        can revisit this page anytime at /welcome.
      </footer>
    </main>
  )
}
