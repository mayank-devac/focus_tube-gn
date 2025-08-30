"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function PomodoroTimer({ focusMin = 25, breakMin = 5 }: { focusMin?: number; breakMin?: number }) {
  const [isFocus, setIsFocus] = useState(true)
  const [remaining, setRemaining] = useState(focusMin * 60)
  const [running, setRunning] = useState(false)
  const ref = useRef<number | null>(null)

  // Flashcard local state
  type Card = { q: string; a: string }
  const [cards, setCards] = useState<Card[]>([])
  const [idx, setIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [newQ, setNewQ] = useState("")
  const [newA, setNewA] = useState("")

  // AI Flashcard (Grok) state
  const [genTopic, setGenTopic] = useState("")
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const grokAbortRef = useRef<AbortController | null>(null)
  const deckRef = useRef<HTMLDivElement | null>(null)
  const [deckOpen, setDeckOpen] = useState(false)

  useEffect(() => {
    if (!running) return
    ref.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          const next = !isFocus
          setIsFocus(next)
          return (next ? breakMin : focusMin) * 60
        }
        return r - 1
      })
    }, 1000)
    return () => {
      if (ref.current) window.clearInterval(ref.current)
    }
  }, [running, isFocus, focusMin, breakMin])

  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60

  // Helpers for flashcards
  const hasCards = cards.length > 0
  const current = hasCards ? cards[idx] : null
  const addCard = () => {
    if (!newQ.trim() || !newA.trim()) return
    setCards((prev) => [...prev, { q: newQ.trim(), a: newA.trim() }])
    setNewQ("")
    setNewA("")
    if (!hasCards) {
      setIdx(0)
      setShowAnswer(false)
    }
  }
  const nextCard = () => {
    if (!hasCards) return
    setIdx((i) => (i + 1) % cards.length)
    setShowAnswer(false)
  }
  const prevCard = () => {
    if (!hasCards) return
    setIdx((i) => (i - 1 + cards.length) % cards.length)
    setShowAnswer(false)
  }

  async function generateWithGrok() {
    const topic = genTopic.trim()
    if (!topic) return
    setGenLoading(true)
    setGenError(null)
    try {
      // abort any in-flight request
      if (grokAbortRef.current) {
        grokAbortRef.current.abort()
      }
      const controller = new AbortController()
      grokAbortRef.current = controller

      const resp = await fetch("/api/ai/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: topic }),
        signal: controller.signal,
      })
      if (!resp.ok) throw new Error(`Grok request failed (${resp.status})`)
      const data = await resp.json()

      const question = (typeof data.question === "string" && data.question.trim()) || topic
      const answer = (data.answer || data.text || data.result || "").toString().trim()
      if (!answer) throw new Error("No answer returned from Grok")

      setCards((prev) => [...prev, { q: question, a: answer }])

      setDeckOpen(true)
      requestAnimationFrame(() => {
        deckRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })

      setGenTopic("")
    } catch (err: unknown) {
      if ((err as any)?.name === "AbortError") {
        // silently ignore aborts
      } else {
        const msg = err instanceof Error ? err.message : "Failed to generate flashcard"
        setGenError(msg)
      }
    } finally {
      setGenLoading(false)
      // clear controller
      grokAbortRef.current = null
    }
  }

  return (
    <div className="space-y-4">
      {/* Timer card */}
      <div className="flex items-center gap-3 rounded-md border p-3">
        <div className="min-w-[110px] text-center">
          <div className="text-xs text-muted-foreground">{isFocus ? "Focus" : "Break"}</div>
          <div className="tabular-nums text-xl font-semibold">
            {mm}:{String(ss).padStart(2, "0")}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Start"}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setIsFocus(true)
              setRemaining(focusMin * 60)
              setRunning(false)
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-3">
        <div className="mb-2 text-sm font-medium">AI Flashcard (Grok)</div>
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            placeholder="Enter a topic or concept (e.g., Newton's 2nd law)"
            aria-label="Flashcard topic"
          />
          <Button onClick={generateWithGrok} disabled={genLoading || !genTopic.trim()}>
            {genLoading ? "Generating..." : "Generate with Grok"}
          </Button>
        </div>
        {genError && (
          <div className="mt-2 text-xs text-red-600" role="alert" aria-live="polite">
            {genError}
          </div>
        )}
        <div className="mt-2 text-xs text-muted-foreground">
          Uses Grok (xAI) via a server route to create one Q&A card and add it to your deck.
        </div>
      </div>

      {/* Flashcards deck - separate card */}
      <div ref={deckRef} className="rounded-md border p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Flashcards</div>
          <Button variant="ghost" size="sm" onClick={() => setDeckOpen((v) => !v)} aria-expanded={deckOpen}>
            {deckOpen ? "Hide" : "Show"}
          </Button>
        </div>

        {deckOpen && (
          <>
            {/* Card viewer */}
            <div className="rounded-md border p-3">
              {!hasCards ? (
                <div className="text-sm text-muted-foreground">No cards yet. Add a question and answer below.</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    Card {idx + 1} of {cards.length}
                  </div>
                  <div className="rounded bg-muted/40 p-3">
                    <div className="text-xs text-muted-foreground mb-1">Question</div>
                    <div className="text-pretty">{current?.q}</div>
                  </div>
                  <div className="rounded bg-muted/40 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Answer</div>
                      <Button variant="ghost" size="sm" onClick={() => setShowAnswer((s) => !s)}>
                        {showAnswer ? "Hide" : "Show"}
                      </Button>
                    </div>
                    {showAnswer ? (
                      <div className="mt-1 text-pretty">{current?.a}</div>
                    ) : (
                      <div className="mt-1 italic text-muted-foreground">Hidden</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={prevCard} disabled={!hasCards}>
                      Prev
                    </Button>
                    <Button size="sm" onClick={nextCard} disabled={!hasCards}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Add card form */}
            <div className="mt-3 space-y-2">
              <Input
                value={newQ}
                onChange={(e) => setNewQ(e.target.value)}
                placeholder="Question"
                aria-label="Flashcard question"
              />
              <Textarea
                value={newA}
                onChange={(e) => setNewA(e.target.value)}
                placeholder="Answer"
                aria-label="Flashcard answer"
                className="min-h-[80px]"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={addCard} disabled={!newQ.trim() || !newA.trim()}>
                  Add card
                </Button>
                <div className="text-xs text-muted-foreground">Tip: Keep cards short and specific.</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
