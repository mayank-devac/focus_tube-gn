import type { NextRequest } from "next/server"
import { getVideoDetails } from "@/lib/youtube"
import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { question, videoId, context } = body as { question?: string; videoId?: string; context?: string }
  if (!question) {
    return new Response(JSON.stringify({ error: "Missing question" }), { status: 400 })
  }

  let grounding = context || ""
  try {
    if (videoId && !grounding) {
      const meta = await getVideoDetails(videoId)
      if (meta) {
        grounding = `Title: ${meta.title}\nChannel: ${meta.channelTitle}\nDescription:\n${meta.description}`
      }
    }
  } catch (e: any) {
    // If YouTube API is unavailable (e.g., missing YOUTUBE_API_KEY), proceed with provided context only
    console.error("Error fetching video details:", e.message)
  }

  try {
    const { text } = await generateText({
      model: xai("grok-4"),
      system:
        "You are a precise tutor. Answer using only the provided context; if unsure, state the uncertainty. Prefer short, stepwise explanations.",
      prompt: `Context:\n${grounding}\n\nQuestion: ${question}\n\nAnswer:`,
    })
    return Response.json({ answer: text })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "AI Q&A failed" }), { status: 500 })
  }
}
