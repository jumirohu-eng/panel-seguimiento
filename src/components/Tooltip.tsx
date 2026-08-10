'use client'

import { useState, ReactNode } from 'react'

export default function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-border bg-card p-2 text-xs font-normal text-card-foreground shadow-sm"
        >
          {content}
        </span>
      )}
    </span>
  )
}
