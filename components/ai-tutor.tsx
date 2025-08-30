"use client"

import useSWR from "swr"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import ReactMarkdown from "react-markdown"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function AITutor({ videoId, seedContext }: { videoId?: string; seedContext?: string }) {
  const [question, setQuestion] = useState("")
  const [context, setContext] = useState(seedContext || "")
  const [summary, setSummary] = useState<string | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: web, mutate: refreshWeb } = useSWR(
    () => (question ? `/api/websearch?q=${encodeURIComponent(question)}` : null),
    fetcher,
  )

  const summarize = async () => {
    setLoading(true)
    setSummary(null)
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        body: JSON.stringify({ videoId, context }),
      })
      const j = await res.json()
      setSummary(j.summary || j.error || "No summary.")
    } finally {
      setLoading(false)
    }
  }

  const ask = async () => {
    setLoading(true)
    setAnswer(null)
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        body: JSON.stringify({ videoId, context, question }),
      })
      const j = await res.json()
      setAnswer(j.answer || j.error || "No answer.")
      refreshWeb()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Tutor</h3>
        <div className="text-xs text-muted-foreground">Summarize, ask questions, search web</div>
      </div>

      <div className="space-y-2">
        <Button onClick={summarize} disabled={loading}>
          Summarize This
        </Button>
        {summary && (
          <div className="rounded-md border p-3 text-sm">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Input placeholder="Ask about this content..." value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Button onClick={ask} disabled={loading || !question.trim()}>
          Ask
        </Button>
        {answer && (
          <div className="rounded-md border p-3 text-sm">
            <ReactMarkdown>{answer}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Optional context (paste transcript/notes)</div>
        <Textarea value={context} onChange={(e) => setContext(e.target.value)} className="h-24" />
      </div>

      {web?.results?.length ? (
        <div className="space-y-2">
          <div className="text-xs font-medium">Related web results</div>
          <ul className="space-y-2">
            {web.results.map((r: any, idx: number) => (
              <li key={idx} className="text-sm">
                <a href={r.url || "#"} target="_blank" rel="noreferrer" className="underline">
                  {r.title} — <span className="text-muted-foreground">{r.source}</span>
                </a>
                <div className="line-clamp-2 text-xs text-muted-foreground">{r.snippet}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
