"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const ROLES = [
  { id: "learner", label: "Learner" },
  { id: "student", label: "Student" },
  { id: "developer", label: "Developer" },
  { id: "teacher", label: "Teacher" },
  { id: "researcher", label: "Researcher" },
  { id: "journalist", label: "Journalist" },
] as const

export type RoleId = (typeof ROLES)[number]["id"]

export function RoleSelector({ value, onChange }: { value: RoleId; onChange: (v: RoleId) => void }) {
  const [active, setActive] = useState<RoleId>(value || "learner")
  const handle = (id: RoleId) => {
    setActive(id)
    onChange(id)
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => (
        <Button key={r.id} variant={active === r.id ? "default" : "secondary"} onClick={() => handle(r.id)}>
          {r.label}
        </Button>
      ))}
    </div>
  )
}
