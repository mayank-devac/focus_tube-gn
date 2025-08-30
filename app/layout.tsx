import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={<div>Loading...</div>}>
          <div className="fixed right-4 top-4 z-50">
            <Link href="/welcome" aria-label="Open Settings to edit your welcome preferences">
              <Button variant="ghost" size="sm" className="rounded-full">
                Settings
              </Button>
            </Link>
          </div>
        </Suspense>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
