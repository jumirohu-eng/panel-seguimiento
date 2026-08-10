'use client'

import { useState, RefObject } from 'react'

export default function ExportPDF({
  targetRef,
  fileName,
}: {
  targetRef: RefObject<HTMLDivElement | null>
  fileName: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    if (!targetRef.current) return
    setLoading(true)
    setError(null)
    try {
      // Tailwind v4 compila utilidades con opacidad (bg-x/10, border-x/30…) a
      // color-mix(in oklab, ...), que html2canvas no sabe parsear ("Attempting to
      // parse an unsupported color function"). html2canvas-pro sí lo soporta.
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 2,
      })
      const imgData = canvas.toDataURL('image/png')

      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${fileName}.pdf`)
    } catch (err) {
      console.error('Error al exportar PDF', err)
      setError('No se pudo generar el PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleExport}
        disabled={loading}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
      >
        {loading ? 'Generando…' : 'Exportar PDF'}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
