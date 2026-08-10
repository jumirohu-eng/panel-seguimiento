import Link from 'next/link'
import PlanesCards from '@/components/PlanesCards'

function linkWhatsapp(mensaje: string): string | null {
  const numero = (process.env.NEXT_PUBLIC_JUANMI_WHATSAPP ?? '').replace(/\D/g, '')
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

export default function Home() {
  const href = linkWhatsapp('Hola, estoy interesado en RetainCoach')

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-4 py-16 sm:px-6">
        <section className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-semibold text-card-foreground sm:text-4xl">
            Bienvenido a RetainCoach
          </h1>
          <p className="max-w-xl text-base text-muted">
            La plataforma de retención para entrenadores personales y nutricionistas online: check-ins
            automáticos, análisis con IA y alertas para que no se te escape ningún cliente.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              Login
            </Link>
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-card-foreground transition hover:bg-card"
              >
                ¿Interesado? Contacta a nuestro equipo
              </a>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-center text-xl font-semibold text-card-foreground">Planes disponibles</h2>
          <PlanesCards />
        </section>
      </div>
    </main>
  )
}
