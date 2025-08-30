"use client"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { useInterests } from "@/hooks/use-interests"

function toHMS(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`
}

export function VideoCard({
  id,
  title,
  channelTitle,
  thumbnail,
  durationSec,
}: {
  id: string
  title: string
  channelTitle: string
  thumbnail: string
  durationSec: number
}) {
  const { recordVideoClick } = useInterests()
  const onOpen = () => recordVideoClick({ id, title, channelTitle })

  return (
    <Link href={`/watch/${id}`} onClick={onOpen}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail || "/placeholder.svg?height=180&width=320&query=educational%20video%20thumbnail"}
            alt={title}
            className="h-44 w-full object-cover"
          />
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
            {toHMS(durationSec)}
          </span>
        </div>
        <CardContent className="p-3">
          <h3 className="text-pretty text-sm font-medium line-clamp-2">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{channelTitle}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
