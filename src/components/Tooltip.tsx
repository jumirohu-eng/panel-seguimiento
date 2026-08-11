'use client'

import { useLayoutEffect, useRef, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_MARGIN = 8
const TRIGGER_GAP = 8

interface Position {
  top: number
  left: number
}

export default function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Se mide en dos pasadas: primero se monta oculto para poder leer su tamaño real,
  // luego se calcula la posición final (arriba si cabe, si no abajo) y se hace visible.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return

    function computePosition() {
      if (!triggerRef.current || !tooltipRef.current) return
      const trigger = triggerRef.current.getBoundingClientRect()
      const tooltip = tooltipRef.current.getBoundingClientRect()

      const cabeArriba = trigger.top - tooltip.height - TRIGGER_GAP >= VIEWPORT_MARGIN
      const top = cabeArriba
        ? trigger.top - tooltip.height - TRIGGER_GAP
        : Math.min(trigger.bottom + TRIGGER_GAP, window.innerHeight - tooltip.height - VIEWPORT_MARGIN)

      const centrado = trigger.left + trigger.width / 2 - tooltip.width / 2
      const left = Math.min(
        Math.max(centrado, VIEWPORT_MARGIN),
        window.innerWidth - tooltip.width - VIEWPORT_MARGIN
      )

      setPosition({ top, left })
    }

    computePosition()
    window.addEventListener('scroll', computePosition, true)
    window.addEventListener('resize', computePosition)
    return () => {
      window.removeEventListener('scroll', computePosition, true)
      window.removeEventListener('resize', computePosition)
    }
  }, [open])

  function show() {
    setOpen(true)
  }
  function hide() {
    setOpen(false)
    setPosition(null)
  }

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            style={{
              position: 'fixed',
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="z-[1000] w-64 rounded-lg border border-border bg-card p-2 text-xs font-normal text-card-foreground shadow-lg"
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  )
}
