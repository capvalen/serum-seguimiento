# serums-seguimiento

Aplicación **Vue 3 + Vite** desplegada en **Cloudflare Workers**, con **KV** como
almacenamiento y **Hono** para la API.

## Project Setup

```sh
npm install
```

> Para ejecutar la aplicación completa (Worker + KV) consulta
> [Desarrollo local con el Worker](#desarrollo-local-con-el-worker).

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

## Historial de instalación

Resumen de los pasos seguidos para dejar el proyecto listo: **Vue 3 + Vite** sobre
**Cloudflare Workers**, con **KV** como almacenamiento y **Hono** como framework de API.

### 1. Crear el proyecto

```sh
npm create vue@latest
```

Genera un proyecto de Vue 3 con Vite y TypeScript.

### 2. Añadir Wrangler

```sh
npm install --save-dev wrangler
```

### 3. Iniciar sesión en Cloudflare

```sh
npx wrangler login
```

### 4. Crear `wrangler.toml` con el binding del KV

```toml
name = "serum-seguimiento"
compatibility_date = "2026-01-01"
main = "worker/index.ts"

[assets]
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

[[kv_namespaces]]
binding = "kv_serums"
id = "<ID_DEL_NAMESPACE>"
```

### 5. Añadir los tipos de Workers

```sh
npm install -D @cloudflare/workers-types
```

Permite que TypeScript conozca los tipos del runtime de Workers
(`Request`, `Response`, `KVNamespace`, etc.).

### 6. Configurar el Worker y los assets estáticos

En `wrangler.toml`:

- `main` → punto de entrada del Worker (`worker/index.ts`).
- `[assets] directory` → sirve el SPA compilado desde `./dist`.
- `run_worker_first = ["/api/*"]` → solo las rutas `/api/*` llegan al Worker;
  el resto lo resuelve Static Assets (con fallback a `index.html` del SPA).

### 7. Instalar Hono

```sh
npm install hono
```

### 8. Crear la API en `worker/index.ts`

El Worker se conecta al KV mediante el binding (`c.env.kv_serums`) y define las
rutas con Hono.

### Unificar el backend con el desarrollo del frontend

Para unificar el backend serverless con el servidor de desarrollo del frontend,
instala el plugin oficial de Cloudflare para Vite:

```sh
npm install -D @cloudflare/vite-plugin
```

Y añádelo a la configuración de `vite.config.ts`:

```ts
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [vue(), cloudflare()],
})
```

Con este plugin, un único servidor sirve el frontend, el Worker y los bindings
(KV) durante el desarrollo, sin necesidad de ejecutar `wrangler dev` por separado.

### 9. Consumir la API desde el frontend

Con `fetch` a las rutas `/api/*` (GET, POST y demás métodos definidos en Hono).

## Scripts disponibles

Añade estos comandos a la sección `scripts` de `package.json`:

```json
{
  "scripts": {
    "cf:deploy": "npm run build && wrangler deploy"
  }
}
```

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de Vite (solo frontend, con HMR) + plugin de Worker en un solo puerto|
| `npm run build` | Compila y tipo-comprueba; genera `./dist` |
| `npm run preview` | Previsualiza el build de Vite |
| `npm run cf:deploy` | Compila (`build`) y despliega Worker + assets + bindings |

### Desarrollo local con el Worker

`wrangler dev` sirve la SPA **compilada** desde `./dist`, así que compila antes:

```sh
npm run build
npm run cf:dev      # http://localhost:8787
```

- **Local Explorer** (ver/editar KV, trazas y logs):
  `http://localhost:8787/cdn-cgi/local/explorer`
- El KV local empieza vacío. Para sembrar datos:

```sh
npx wrangler kv key put <clave> "<valor>" --binding=kv_serums --local
```

> **Alternativa con HMR de Vite:** ejecuta `npx wrangler dev` en una terminal y
> `npm run dev` en otra. Vite redirige `/api/*` al Worker mediante el proxy
> definido en `vite.config.ts`.

### Endpoints de ejemplo

```
GET /api/usuario/:email       → obtiene el usuario del KV o lo crea si no existe
```

