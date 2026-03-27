"use client"

import { useRef, type ReactNode } from "react"
import { useScroll, useTransform, motion } from "framer-motion"

interface StackingCardsProps {
  children: ReactNode
  totalCards: number
  scrollOptons?: {
    container?: { current: HTMLElement | null }
  }
}

export function StackingCards({ children, totalCards, scrollOptons }: StackingCardsProps) {
  return <div className="relative">{children}</div>
}

interface StackingCardItemProps {
  children: ReactNode
  index: number
  className?: string
}

export function StackingCardItem({ children, index, className = "" }: StackingCardItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.95])
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0.3])
  const y = useTransform(scrollYProgress, [0, 0.5, 1], [100, 0, -50])

  return (
    <motion.div
      ref={ref}
      style={{
        scale,
        opacity,
        y,
        position: "sticky",
        top: `${index * 40 + 80}px`,
      }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  )
}
