'use client'

import { useState } from 'react'

export default function SuggestedMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  if (!message.trim()) return null

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between text-left text-sm font-semibold text-card-foreground"
        >
          Mensaje sugerido
          <span className="text-muted">{open ? '−' : '+'}</span>
        </button>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white transition hover:opacity-90"
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
      {open && <p className="mt-3 whitespace-pre-wrap text-sm text-card-foreground">{message}</p>}
    </div>
  )
}
