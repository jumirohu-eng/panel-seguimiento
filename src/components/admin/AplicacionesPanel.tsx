'use client'

import { useState } from 'react'

export default function AplicacionesPanel() {
  const [showQuick, setShowQuick] = useState(false)

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <button
        onClick={() => setShowQuick((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="text-lg font-semibold text-card-foreground">Aplicaciones</h2>
        <span className="text-muted">{showQuick ? '▲' : '▼'}</span>
      </button>
      {showQuick && (
        <div className="flex flex-wrap gap-2 border-t border-border p-6 pt-4">
          <a
            href="https://airtable.com/appZ7NZWDl6haw8pK"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
          >
            Airtable
          </a>
          <a
            href="https://jolly-wolf-51.fr-1.instapods.app"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
          >
            n8n
          </a>
          <a
            href="https://supabase.com/dashboard/project/jcijxhxdjabxdujldzml"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-card-foreground hover:bg-background"
          >
            Supabase
          </a>
        </div>
      )}
    </section>
  )
}
