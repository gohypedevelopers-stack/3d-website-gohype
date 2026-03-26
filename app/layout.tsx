import type { Metadata } from "next"
import type { ReactNode } from "react"

import CursorSpotlight from "../lib/components/cursor-spotlight"
import "./globals.css"

export const metadata: Metadata = {
  title: "GoHype Media",
  description: "Immersive 3D websites and motion-rich digital experiences.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <CursorSpotlight />
        {children}
      </body>
    </html>
  )
}
