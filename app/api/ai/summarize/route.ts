import type { NextRequest } from "next/server"
import { getVideoDetails } from "@/lib/youtube"
import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { videoId, context } = body as { videoId?: string; context?: string }
  if (!videoId && !context) {
    return new Response(JSON.stringify({ error: "Provide videoId or context" }), { status: 400 })
  }

  let baseText = context || ""
  try {
    if (videoId && !baseText) {
      const meta = await getVideoDetails(videoId)
      if (meta) {
        baseText ||= `Title: ${meta.title}\nChannel: ${meta.channelTitle}\nDescription:\n${meta.description}`
      }
    }
  } catch (e: any) {
    // If YouTube API is unavailable (e.g., missing YOUTUBE_API_KEY), continue without video metadata
  }

  try {
    const { text } = await generateText({
      model: xai("grok-4"),
      system:
        "You are a concise study assistant. Produce a tight study summary with: key takeaways, core concepts, and 3-5 actionable bullets. Avoid fluff.",
      prompt: `Summarize the following learning content for focused studying:\n\n${baseText}`,
    })
    return Response.json({ summary: text })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "AI summarize failed" }), { status: 500 })
  }
}
