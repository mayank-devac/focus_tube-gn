import { getVideoDetails } from "@/lib/youtube"
import { AITutor } from "@/components/ai-tutor"
import { PomodoroTimer } from "@/components/pomodoro-timer"

export default async function WatchPage({ params }: { params: { id: string } }) {
  const video = await getVideoDetails(params.id)
  if (!video) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-lg font-semibold">Video not found</h1>
      </main>
    )
  }

  const playerSrc = `https://www.youtube.com/embed/${video.id}?modestbranding=1&rel=0&fs=1&iv_load_policy=3`

  return (
    <main className="flex max-w-6xl flex-col gap-6 p-6 mx-[opx][8p] py-[8] py-[] py-[2] py-[24p] py-2 py-2 py-0.5 py-0 px-2 px-[8p] px-[8] px-[] px-[2] px-[24p] px-2 px-2 px-1.5 px-2 px-2.5 px-2 px-1.5 px-1 px-0.5 px-0">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section className="md:col-span-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-md border">
            <iframe
              src={playerSrc}
              title={video.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <h1 className="mt-3 text-xl font-semibold text-pretty">{video.title}</h1>
          <p className="text-sm text-muted-foreground">{video.channelTitle}</p>
          <div className="mt-3">
            <PomodoroTimer />
          </div>
        </section>

        <aside className="flex flex-col gap-4 md:col-span-1">
          <div className="rounded-md border p-3">
            <h3 className="text-sm font-semibold">Notes</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Highlight and take concise notes while watching. Transcript integration can be added later.
            </p>
          </div>
          <div className="rounded-md border p-3">
            <AITutor videoId={video.id} seedContext={`Title: ${video.title}\nDescription:\n${video.description}`} />
          </div>
        </aside>
      </div>
    </main>
  )
}
