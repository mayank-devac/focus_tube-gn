import { NextResponse } from "next/server"
import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 })
    }
    if (!process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "Missing XAI_API_KEY" }, { status: 500 })
    }

    const { text } = await generateText({
      model: xai("grok-4", {
        apiKey: process.env.XAI_API_KEY,
      }),
      prompt: `Create ONE educational flashcard as compact JSON with fields: question, answer.
Return ONLY JSON. Topic: ${prompt}

Example:
{"question":"What is photosynthesis?","answer":"The process by which plants convert light energy into chemical energy, producing glucose and oxygen."}`,
      temperature: 0.2,
      maxTokens: 220,
    })

    let card: { question: string; answer: string }
    try {
      card = JSON.parse(text)
    } catch {
      const q = text.split("\n")[0]?.trim() || `Flashcard: ${prompt}`
      const a = text.trim()
      card = { question: q, answer: a }
    }

    const question = String(card.question || prompt).slice(0, 200)
    const answer = String(card.answer || "").slice(0, 1200)

    return NextResponse.json({ question, answer })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Flashcard generation failed" }, { status: 500 })
  }
}
