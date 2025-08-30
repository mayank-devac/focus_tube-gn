"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function SearchBar({
  onSearch,
  placeholder = "Search educational videos (no shorts, no clickbait)…",
}: {
  onSearch: (q: string) => void
  placeholder?: string
}) {
  const [val, setVal] = useState("")
  return (
    <div className="flex w-full max-w-xl items-center gap-2">
      <Input placeholder={placeholder} value={val} onChange={(e) => setVal(e.target.value)} className="flex-1" />
      <Button onClick={() => onSearch(val)} disabled={!val.trim()}>
        Search
      </Button>
    </div>
  )
}
