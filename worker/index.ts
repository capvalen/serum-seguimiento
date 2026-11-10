/// <reference types="@cloudflare/workers-types" />

import { Hono } from 'hono'

/**
 * Worker que sirve el SPA (Workers Static Assets) y expone la API para leer el KV.
 *
 * El binding `kv_serums` viene definido en wrangler.toml.
 */
export interface Env {
  kv_serums: KVNamespace
}

interface Servicio {
  servicio: string
  abreviatura: string
}

/** Datos del establecimiento de salud del usuario. */
export interface Establecimiento {
  anio: string
  centroSalud: string
  tipoSerum: 'remunerada' | 'equivalente'
}

/** Valores por defecto del establecimiento. */
export const ESTABLECIMIENTO_POR_DEFECTO: Establecimiento = {
  anio: 'Año de la Esperanza y el Fortalecimiento de la Democracia',
  centroSalud: '',
  tipoSerum: 'remunerada',
}

/** Mapa de servicios -> número de atendidos para una fecha concreta. */
export interface AtencionesDia {
  [servicio: string]: number
}

/**
 * Mapa de atenciones con la forma:
 * fechaISO -> servicio -> atendidos.
 *
 * La fecha usa formato ISO `YYYY-MM-DD`, por lo que las claves
 * ordenan alfabéticamente igual que cronológicamente.
 *
 * Ejemplo:
 * {
 *   "2026-02-16": { "triaje": 25, "cred": 12 },
 *   "2026-02-17": { "triaje": 18 }
 * }
 */
export interface Atenciones {
  [fechaISO: string]: AtencionesDia
}

interface DatosUsuario {
  servicios: Servicio[]
  atenciones: Atenciones
  establecimiento: Establecimiento
}

/** Estructura por defecto que se crea cuando el correo no existe en el KV. */
const SERVICIOS_POR_DEFECTO: Servicio[] = [
  { servicio: 'triaje', abreviatura: '' },
  { servicio: 'enfermedades no transmisibles', abreviatura: 'enf no tr.' },
  { servicio: 'Control de Crecimiento y Desarrollo', abreviatura: 'CRED' },
  { servicio: 'tuberculosis', abreviatura: 'tb' },
  { servicio: 'visita domiciliaria', abreviatura: 'visita dom.' },
  { servicio: 'inmunización', abreviatura: '' },
  { servicio: 'Etapa joven', abreviatura: 'joven' },
  { servicio: 'enfermería', abreviatura: '' },
  { servicio: 'campaña de vacunación', abreviatura: 'campaña vac.' },
  { servicio: 'Capacitación', abreviatura: '' },
  { servicio: 'adolescente', abreviatura: '' },
  { servicio: 'tópico', abreviatura: '' },
]

const app = new Hono<{ Bindings: Env }>()

/**
 * Registra (upsert) cuántos atendidos hubo de un servicio en una fecha ISO.
 * Si ya existía el servicio para ese día, sobreescribe el valor.
 */
export function registrarAtencion(
  at: Atenciones,
  fechaISO: string,
  servicio: string,
  atendidos: number,
) {
  at[fechaISO] ??= {}
  at[fechaISO][servicio] = atendidos
}

/**
 * Elimina un servicio de una fecha.
 * Si el día queda vacío, se elimina también la fecha.
 */
export function eliminarAtencion(
  at: Atenciones,
  fechaISO: string,
  servicio: string,
) {
  const dia = at[fechaISO]
  if (!dia) return
  delete dia[servicio]
  if (Object.keys(dia).length === 0) delete at[fechaISO]
}

/**
 * Normaliza el nombre de un servicio: primera letra en mayúscula y el resto
 * en minúscula (ej. "enfermedades NO transmisibles" -> "Enfermedades no transmisibles").
 */
export function normalizarServicio(nombre: string) {
  const limpio = nombre.trim()
  if (!limpio) return ''
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase()
}

/**
 * Renombra la clave de un servicio en todas las atenciones registradas.
 * Así el histórico sigue coincidiendo tras editar el catálogo.
 */
export function renombrarEnAtenciones(
  at: Atenciones,
  servicioOriginal: string,
  servicioNuevo: string,
) {
  const viejo = servicioOriginal.toLowerCase()
  for (const dia of Object.values(at)) {
    for (const clave of Object.keys(dia)) {
      if (clave.toLowerCase() !== viejo) continue
      const atendidos = dia[clave]
      delete dia[clave]
      dia[servicioNuevo] = (dia[servicioNuevo] ?? 0) + atendidos
    }
  }
}

/**
 * Reporte de un día concreto (fecha ISO `YYYY-MM-DD`).
 * Devuelve el desglose por servicio y el total del día.
 */
export function reportePorDia(at: Atenciones, fechaISO: string) {
  const servicios = at[fechaISO] ?? {}
  const total = Object.values(servicios).reduce((a, b) => a + b, 0)
  return { fecha: fechaISO, total, servicios }
}

/**
 * Reporte de un mes (`YYYY-MM`).
 * Suma los atendidos de cada servicio y el total de cada día.
 * `detalle` mantiene el desglose servicio -> atendidos para cada día del mes.
 */
export function reportePorMes(at: Atenciones, anioMes: string) {
  const servicios: Record<string, number> = {}
  const dias: Record<string, number> = {}
  const detalle: Record<string, Record<string, number>> = {}
  let total = 0

  for (const [fecha, dia] of Object.entries(at)) {
    if (!fecha.startsWith(anioMes)) continue

    let totalDia = 0
    for (const [servicio, atendidos] of Object.entries(dia)) {
      servicios[servicio] = (servicios[servicio] ?? 0) + atendidos
      totalDia += atendidos
      total += atendidos
    }
    dias[fecha] = totalDia
    detalle[fecha] = { ...dia }
  }

  return { mes: anioMes, total, dias, detalle, servicios }
}



app.get('/api/saluda/:nombre', async (c) => {

	const nombre = c.req.param('nombre')
	return c.json({ message: `¡Hola, ${nombre}!` })
})

/**
 * GET /api/datos/:correo
 *
 * Busca en el KV usando el correo como clave.
 * - Si existe: devuelve el JSON almacenado ya parseado.
 * - Si no existe: crea el registro con los servicios por defecto
 *   (guardado como string con JSON.stringify) y lo devuelve parseado.
 */
app.get('/api/datos/:correo', async (c) => {
  const correo = c.req.param('correo')

  const existente = await c.env.kv_serums.get(correo)
  if (existente) {
    const datos = JSON.parse(existente) as DatosUsuario
    // Compatibilidad con registros creados antes de existir `establecimiento`.
    datos.establecimiento = {
      ...ESTABLECIMIENTO_POR_DEFECTO,
      ...(datos.establecimiento ?? {}),
    }
    return c.json(datos)
  }

  const datos: DatosUsuario = {
    servicios: SERVICIOS_POR_DEFECTO,
    atenciones: {},
    establecimiento: { ...ESTABLECIMIENTO_POR_DEFECTO },
  }
  await c.env.kv_serums.put(correo, JSON.stringify(datos))

  return c.json(datos, 201)
})

/**
 * GET /api/reporte/:correo/dia/:fecha
 *
 * Reporte de un día. `fecha` en formato ISO `YYYY-MM-DD`.
 */
app.get('/api/reporte/:correo/dia/:fecha', async (c) => {
  const correo = c.req.param('correo')
  const fecha = c.req.param('fecha')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const datos = JSON.parse(existente) as DatosUsuario
  return c.json(reportePorDia(datos.atenciones ?? {}, fecha))
})

/**
 * POST /api/atenciones/:correo
 *
 * Registra (upsert) los atendidos de un servicio en un día.
 * Body JSON: `{ fecha, servicio, atendidos, servicioOriginal? }`
 *
 * Si se envía `servicioOriginal` y es distinto de `servicio`, se elimina
 * la clave anterior (permite renombrar el servicio sin duplicarlo).
 * Devuelve el reporte del día actualizado.
 */
app.post('/api/atenciones/:correo', async (c) => {
  const correo = c.req.param('correo')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const body = await c.req.json<{
    fecha: string
    servicio: string
    atendidos: number
    servicioOriginal?: string
  }>()

  if (!body.fecha || !body.servicio || typeof body.atendidos !== 'number') {
    return c.json({ error: 'Datos incompletos' }, 400)
  }

  const datos = JSON.parse(existente) as DatosUsuario
  datos.atenciones ??= {}

  // Si se renombró el servicio, se borra la clave antigua.
  if (body.servicioOriginal && body.servicioOriginal !== body.servicio) {
    eliminarAtencion(datos.atenciones, body.fecha, body.servicioOriginal)
  }

  registrarAtencion(datos.atenciones, body.fecha, body.servicio, body.atendidos)
  await c.env.kv_serums.put(correo, JSON.stringify(datos))

  return c.json(reportePorDia(datos.atenciones, body.fecha))
})

/**
 * DELETE /api/atenciones/:correo
 *
 * Elimina el registro de un servicio en un día.
 * Body JSON: `{ fecha, servicio }`
 * Devuelve el reporte del día actualizado.
 */
app.delete('/api/atenciones/:correo', async (c) => {
  const correo = c.req.param('correo')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const body = await c.req.json<{ fecha: string; servicio: string }>()
  if (!body.fecha || !body.servicio) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }

  const datos = JSON.parse(existente) as DatosUsuario
  datos.atenciones ??= {}
  eliminarAtencion(datos.atenciones, body.fecha, body.servicio)
  await c.env.kv_serums.put(correo, JSON.stringify(datos))

  return c.json(reportePorDia(datos.atenciones, body.fecha))
})

/**
 * GET /api/reporte/:correo/mes/:anioMes
 *
 * Reporte de un mes. `anioMes` en formato `YYYY-MM` (ej. `2026-02`).
 */
app.get('/api/reporte/:correo/mes/:anioMes', async (c) => {
  const correo = c.req.param('correo')
  const anioMes = c.req.param('anioMes')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const datos = JSON.parse(existente) as DatosUsuario
  return c.json(reportePorMes(datos.atenciones ?? {}, anioMes))
})

/* -------------------------------------------------------------------------- */
/*  Catálogo de servicios                                                      */
/* -------------------------------------------------------------------------- */

/** ¿Ya existe un servicio con ese nombre (sin distinguir mayúsculas)? */
function existeServicio(servicios: Servicio[], nombre: string, ignorar?: string) {
  const n = nombre.toLowerCase()
  const i = ignorar?.toLowerCase()
  return servicios.some(
    (s) => s.servicio.toLowerCase() === n && s.servicio.toLowerCase() !== i,
  )
}

/**
 * POST /api/servicios/:correo
 *
 * Agrega un servicio al catálogo.
 * Body JSON: `{ servicio, abreviatura }`
 * Devuelve la lista de servicios actualizada.
 */
app.post('/api/servicios/:correo', async (c) => {
  const correo = c.req.param('correo')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const body = await c.req.json<{ servicio: string; abreviatura?: string }>()
  const nombre = normalizarServicio(body.servicio ?? '')
  if (!nombre) return c.json({ error: 'El servicio es obligatorio' }, 400)

  const datos = JSON.parse(existente) as DatosUsuario
  datos.servicios ??= []

  if (existeServicio(datos.servicios, nombre)) {
    return c.json({ error: 'Ese servicio ya existe' }, 409)
  }

  datos.servicios.push({
    servicio: nombre,
    abreviatura: (body.abreviatura ?? '').trim(),
  })
  datos.servicios.sort((a, b) => a.servicio.localeCompare(b.servicio))

  await c.env.kv_serums.put(correo, JSON.stringify(datos))
  return c.json({ servicios: datos.servicios }, 201)
})

/**
 * PUT /api/servicios/:correo
 *
 * Edita un servicio (nombre y abreviatura). Si cambia el nombre, renombra
 * también las claves en las atenciones para no perder el histórico.
 * Body JSON: `{ servicioOriginal, servicio, abreviatura }`
 * Devuelve la lista de servicios actualizada.
 */
app.put('/api/servicios/:correo', async (c) => {
  const correo = c.req.param('correo')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const body = await c.req.json<{
    servicioOriginal: string
    servicio: string
    abreviatura?: string
  }>()

  const original = normalizarServicio(body.servicioOriginal ?? '')
  const nombre = normalizarServicio(body.servicio ?? '')
  if (!original || !nombre) {
    return c.json({ error: 'Datos incompletos' }, 400)
  }

  const datos = JSON.parse(existente) as DatosUsuario
  datos.servicios ??= []

  const indice = datos.servicios.findIndex(
    (s) => s.servicio.toLowerCase() === original.toLowerCase(),
  )
  if (indice === -1) return c.json({ error: 'Servicio no encontrado' }, 404)

  if (existeServicio(datos.servicios, nombre, original)) {
    return c.json({ error: 'Ya existe otro servicio con ese nombre' }, 409)
  }

  datos.servicios[indice] = {
    servicio: nombre,
    abreviatura: (body.abreviatura ?? '').trim(),
  }
  datos.servicios.sort((a, b) => a.servicio.localeCompare(b.servicio))

  // Mantiene el histórico: renombra las claves de las atenciones.
  if (original.toLowerCase() !== nombre.toLowerCase()) {
    datos.atenciones ??= {}
    renombrarEnAtenciones(datos.atenciones, original, nombre)
  }

  await c.env.kv_serums.put(correo, JSON.stringify(datos))
  return c.json({ servicios: datos.servicios })
})

/**
 * DELETE /api/servicios/:correo
 *
 * Elimina un servicio del catálogo (no borra las atenciones ya registradas).
 * Body JSON: `{ servicio }`
 * Devuelve la lista de servicios actualizada.
 */
app.delete('/api/servicios/:correo', async (c) => {
  const correo = c.req.param('correo')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const body = await c.req.json<{ servicio: string }>()
  const nombre = normalizarServicio(body.servicio ?? '')
  if (!nombre) return c.json({ error: 'Datos incompletos' }, 400)

  const datos = JSON.parse(existente) as DatosUsuario
  datos.servicios ??= []
  datos.servicios = datos.servicios.filter(
    (s) => s.servicio.toLowerCase() !== nombre.toLowerCase(),
  )

  await c.env.kv_serums.put(correo, JSON.stringify(datos))
  return c.json({ servicios: datos.servicios })
})

/* -------------------------------------------------------------------------- */
/*  Establecimiento                                                            */
/* -------------------------------------------------------------------------- */

/**
 * PUT /api/establecimiento/:correo
 *
 * Guarda los datos del establecimiento.
 * Body JSON: `{ anio, centroSalud, tipoSerum }`
 * Devuelve el establecimiento actualizado.
 */
app.put('/api/establecimiento/:correo', async (c) => {
  const correo = c.req.param('correo')

  const existente = await c.env.kv_serums.get(correo)
  if (!existente) return c.json({ error: 'No hay datos para ese correo' }, 404)

  const body = await c.req.json<{
    anio?: string
    centroSalud?: string
    tipoSerum?: string
  }>()

  const establecimiento: Establecimiento = {
    anio: (body.anio ?? '').trim(),
    centroSalud: (body.centroSalud ?? '').trim(),
    tipoSerum: body.tipoSerum === 'equivalente' ? 'equivalente' : 'remunerada',
  }

  const datos = JSON.parse(existente) as DatosUsuario
  datos.establecimiento = establecimiento
  await c.env.kv_serums.put(correo, JSON.stringify(datos))

  return c.json({ establecimiento })
})

// El resto de rutas no /api/* las resuelve Static Assets (ver run_worker_first).
app.notFound((c) => c.text('Not Found', 404))

export default app