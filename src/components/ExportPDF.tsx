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

  async function handleExport() {
    if (!targetRef.current) return
    setLoading(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-card-foreground hover:bg-background disabled:opacity-50"
    >
      {loading ? 'Generando…' : 'Exportar PDF'}
    </button>
  )
}
