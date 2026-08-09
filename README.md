# Panel de Seguimiento

Dashboard web para que entrenadores personales vean el estado semanal de sus clientes (peso, entrenamientos, energía, notas y análisis IA), con los datos almacenados en Airtable.

## Stack

- **Framework:** Next.js (App Router)
- **Auth:** Supabase Auth
- **Datos:** Airtable API (vía API Routes — el token nunca se expone al frontend)
- **Gráficas:** Recharts
- **Hosting:** Vercel

## Desarrollo local

```bash
npm install
npm run dev
```

Copia `.env.local` (ya presente, sin commitear) y rellena los valores reales antes de probar:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AIRTABLE_TOKEN=
AIRTABLE_BASE_ID=appZ7NZWDl6haw8pK
```

Abre [http://localhost:3000](http://localhost:3000).

## Seguridad

El token de Airtable (`AIRTABLE_TOKEN`) y la service role key de Supabase solo viven en variables de entorno del servidor. Todas las llamadas a Airtable pasan por las API Routes en `src/app/api/*`, que validan el JWT de Supabase antes de responder.

## Estructura

```
src/
├── app/
│   ├── login/            Formulario de acceso
│   ├── dashboard/        Dashboard principal (protegido)
│   ├── reset-password/   Restablecer contraseña
│   └── api/
│       ├── clientes/     Proxy Airtable — clientes del entrenador
│       └── reportes/     Proxy Airtable — reportes de un cliente
├── components/           Gráficas, selector, header, export PDF, etc.
└── lib/                  Clientes de Supabase, helper de Airtable, tipos
```

## Deploy

Conectado a Vercel. Configura las mismas variables de entorno en el proyecto de Vercel y haz redeploy tras el primer push.
