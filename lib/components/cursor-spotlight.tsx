"use client"

import { useEffect } from "react"

export default function CursorSpotlight() {
  useEffect(() => {
    const root = document.documentElement

  // sensible defaults (punchier spotlight)
  root.style.setProperty('--cursor-size', '300px')
  root.style.setProperty('--cursor-opacity', '1')

    let raf = 0
    let lastX = window.innerWidth / 2
    let lastY = window.innerHeight / 2

    function onMove(e: PointerEvent) {
      lastX = e.clientX
      lastY = e.clientY
      if (!raf) raf = requestAnimationFrame(() => {
        root.style.setProperty('--cursor-x', `${lastX}px`)
        root.style.setProperty('--cursor-y', `${lastY}px`)
        raf = 0
      })
      // ensure visible when moving
      root.style.setProperty('--cursor-opacity', '1')
    }

    function onEnter() {
      root.style.setProperty('--cursor-opacity', '1')
    }

    function onLeave() {
      root.style.setProperty('--cursor-opacity', '0')
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerenter', onEnter)
    document.addEventListener('pointerleave', onLeave)

    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerenter', onEnter)
      document.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return <div className="cursor-spotlight" aria-hidden style={{ opacity: 'var(--cursor-opacity)', pointerEvents: 'none' }} />
}
