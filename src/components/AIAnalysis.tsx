'use client'

import { useState } from 'react'

export default function AIAnalysis({ analysis, tieneAlerta }: { analysis: string; tieneAlerta?: boolean }) {
  const [open, setOpen] = useState(false)

  if (!analysis.trim()) return null

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        tieneAlerta ? 'border-warning/30 bg-warning/10' : 'border-border bg-card'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-card-foreground"
      >
        💡 Análisis IA disponible
        <span className="text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{analysis}</p>}
    </div>
  )
}
