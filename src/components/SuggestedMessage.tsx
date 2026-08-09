'use client'

import { useState } from 'react'

export default function SuggestedMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false)

  if (!message.trim()) return null

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-card-foreground">Mensaje sugerido</h3>
        <button
          onClick={handleCopy}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white transition hover:opacity-90"
        >
          {copied ? '¡Copiado!' : 'Copiar'}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-card-foreground">{message}</p>
    </div>
  )
}
