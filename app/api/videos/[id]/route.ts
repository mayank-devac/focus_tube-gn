import { NextResponse } from "next/server"
import { getVideoDetails, hasYouTubeApiKey } from "@/lib/youtube"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!hasYouTubeApiKey()) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY. Add it in Project Settings > Environment Variables." },
      { status: 500 },
    )
  }
  try {
    const video = await getVideoDetails(params.id)
    if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(video)
  } catch (err: any) {
    return NextResponse.json({ error: "YouTube API error", message: err?.message || "Unknown error" }, { status: 500 })
  }
}
