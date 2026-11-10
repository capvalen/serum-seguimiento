import type { CellObject, Row } from 'write-excel-file/browser'
import type { Establecimiento, ReporteMes, Servicio } from '@/stores/usuario'

/* -------------------------------------------------------------------------- */
/*  Tipos                                                                      */
/* -------------------------------------------------------------------------- */

export interface DatosConsolidado {
  mes: number // 1-12
  anio: number
  reporte: ReporteMes
  catalogo: Servicio[]
  establecimiento: Establecimiento
}

/* -------------------------------------------------------------------------- */
/*  Constantes de estilo                                                       */
/* -------------------------------------------------------------------------- */

const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const AZUL = '#1565C0'
const AZUL_CLARO = '#E3F2FD'
const GRIS = '#F2F6FB'
const GRIS_VACIO = '#D9D9D9'
const BORDE = '#9DB8D2'
const BLANCO = '#FFFFFF'
const TEXTO = '#0A2A4A'
const GRIS_TEXTO = '#5A7288'

const DIAS_POR_SEMANA = 7
const COLUMNAS_POR_DIA = 2 // N° ATC | N° ATD
const COLUMNAS_TOTAL_SEMANAL = 2

/** Ancho total de la tabla más ancha: servicios + 7 días + total semanal. */
const MAX_COLS = 1 + DIAS_POR_SEMANA * COLUMNAS_POR_DIA + COLUMNAS_TOTAL_SEMANAL

/* -------------------------------------------------------------------------- */
/*  Constructores de celdas                                                    */
/* -------------------------------------------------------------------------- */

const borde = { borderColor: BORDE, borderStyle: 'thin' as const }

/**
 * `write-excel-file` exige que las celdas cubiertas por un `columnSpan`
 * se representen como `null`. Este helper expande la celda y añade los
 * `null` necesarios para ocupar el ancho del span.
 */
function celdasSpan(celda: CellObject): Row {
  const span = celda.columnSpan ?? 1
  const fila: Row = [celda]
  for (let i = 1; i < span; i++) fila.push(null)
  return fila
}

function cabecera(extra: Partial<CellObject>): CellObject {
  return {
    backgroundColor: AZUL,
    textColor: BLANCO,
    fontWeight: 'bold',
    align: 'center',
    alignVertical: 'center',
    wrap: true,
    ...borde,
    ...extra,
  }
}

function subcabecera(value: string): CellObject {
  return {
    value,
    backgroundColor: AZUL_CLARO,
    textColor: TEXTO,
    fontWeight: 'bold',
    fontSize: 9,
    align: 'center',
    alignVertical: 'center',
    wrap: true,
    ...borde,
  }
}

function numero(value: number, extra: Partial<CellObject> = {}): CellObject {
  return {
    value,
    type: Number,
    align: 'center',
    alignVertical: 'center',
    ...borde,
    ...extra,
  }
}

/**
 * Celda numérica que deja el texto vacío cuando el valor es 0,
 * conservando el estilo (fondo, bordes, etc.).
 */
function celdaNumero(value: number, extra: Partial<CellObject> = {}): CellObject {
  const base: CellObject = {
    align: 'center',
    alignVertical: 'center',
    ...borde,
    ...extra,
  }
  if (value === 0) return base
  return { ...base, value, type: Number }
}

function etiqueta(value: string): CellObject {
  return {
    value,
    fontWeight: 'bold',
    align: 'left',
    alignVertical: 'center',
    ...borde,
  }
}

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0')

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** "Domingo 1" para el día indicado. */
function etiquetaDia(anio: number, mes: number, dia: number): string {
  const fecha = new Date(anio, mes - 1, dia)
  const wd = new Intl.DateTimeFormat('es', { weekday: 'long' }).format(fecha)
  return `${capitalizar(wd)} ${dia}`
}

/* -------------------------------------------------------------------------- */
/*  Construcción de filas                                                      */
/* -------------------------------------------------------------------------- */

function construirFilas({
  mes,
  anio,
  reporte,
  catalogo,
  establecimiento,
}: DatosConsolidado): Row[] {
  const filas: Row[] = []

  // --- Catálogo por nombre normalizado (evita duplicados por mayúsculas) ---
  const porServicio = new Map<string, Servicio>()
  for (const s of catalogo) porServicio.set(s.servicio.toLowerCase(), s)

  // --- Normalizar el detalle: fecha -> (servicioNormalizado -> atendidos) ---
  const porDia = new Map<string, Map<string, number>>()
  const etiquetas = new Map<
    string,
    { abrev: string; nombre: string; tieneAbrev: boolean }
  >()

  for (const [fecha, servicios] of Object.entries(reporte.detalle ?? {})) {
    const acumulado = new Map<string, number>()

    for (const [servicio, atendidos] of Object.entries(servicios)) {
      const clave = servicio.toLowerCase()
      acumulado.set(clave, (acumulado.get(clave) ?? 0) + atendidos)

      if (!etiquetas.has(clave)) {
        const cat = porServicio.get(clave)
        const abreviatura = (cat?.abreviatura ?? '').trim()
        const nombreServicio = capitalizar(cat?.servicio || servicio)
        etiquetas.set(clave, {
          // Con abreviatura se muestra en MAYÚSCULAS; sin ella, el nombre
          // con la primera letra en mayúscula.
          abrev: abreviatura ? abreviatura.toUpperCase() : nombreServicio,
          nombre: nombreServicio,
          tieneAbrev: Boolean(abreviatura),
        })
      }
    }
    porDia.set(fecha, acumulado)
  }

  // --- Días que tienen al menos un servicio rellenado (> 0) ---
  const diasConDatos = new Set<string>()
  for (const [fecha, servicios] of porDia) {
    const suma = [...servicios.values()].reduce((a, b) => a + b, 0)
    if (suma > 0) diasConDatos.add(fecha)
  }

  const claves = [...etiquetas.keys()].sort((a, b) =>
    (etiquetas.get(a)?.nombre ?? '').localeCompare(etiquetas.get(b)?.nombre ?? ''),
  )

  // --- Semanas de 7 días consecutivos (1-7, 8-14, 15-21, 22-28, 29-fin) ---
  const totalDias = new Date(anio, mes, 0).getDate()
  const semanas: number[][] = []
  for (let inicio = 1; inicio <= totalDias; inicio += DIAS_POR_SEMANA) {
    const semana: number[] = []
    for (let d = inicio; d < inicio + DIAS_POR_SEMANA && d <= totalDias; d++) {
      semana.push(d)
    }
    semanas.push(semana)
  }

  // --- Encabezado del documento ---
  // 1) Año (dato del establecimiento), entre comillas y en negrita.
  const anioTexto = establecimiento.anio.trim()
  filas.push(
    celdasSpan({
      value: anioTexto ? `"${anioTexto}"` : '',
      columnSpan: MAX_COLS,
      fontWeight: 'bold',
      fontSize: 12,
      align: 'center',
      textColor: TEXTO,
    }),
  )
  // Separación.
  filas.push([{ value: '' }])

  // 2) Título: "CONSOLIDADO DE ATENCIONES EN EL <centro de salud>"
  //    (la parte "EN EL ..." solo si hay centro de salud).
  const centro = establecimiento.centroSalud.trim()
  const titulo = centro
    ? `CONSOLIDADO DE ATENCIONES EN EL ${centro}`
    : 'CONSOLIDADO DE ATENCIONES'
  filas.push(
    celdasSpan({
      value: titulo,
      columnSpan: MAX_COLS,
      fontWeight: 'bold',
      fontSize: 16,
      align: 'center',
      textColor: TEXTO,
    }),
  )

  // 3) "SERUMS <TIPO> - <Mes año>"
  filas.push(
    celdasSpan({
      value: `SERUMS ${establecimiento.tipoSerum.toUpperCase()} - ${MESES_NOMBRE[mes - 1]} ${anio}`,
      columnSpan: MAX_COLS,
      fontWeight: 'bold',
      fontSize: 11,
      align: 'center',
      textColor: AZUL,
    }),
  )
  filas.push([{ value: '' }])

  let mensualATC = 0
  let mensualATD = 0

  // --- Una tabla por semana ---
  for (const semana of semanas) {
    // Fila de días: "Servicios" ocupa 2 filas, cada día 2 columnas.
    const filaDias: Row = celdasSpan(cabecera({ value: 'Servicios', rowSpan: 2 }))
    // Fila de subcabeceras: la 1ª celda es "null" (cubierta por el rowSpan de "Servicios").
    const filaSub: Row = [null]

    for (const d of semana) {
      filaDias.push(...celdasSpan(cabecera({ value: etiquetaDia(anio, mes, d), columnSpan: COLUMNAS_POR_DIA })))
      filaSub.push(subcabecera('N° ATC'), subcabecera('N° ATD'))
    }

    filaDias.push(...celdasSpan(cabecera({ value: 'Total semanal', columnSpan: COLUMNAS_TOTAL_SEMANAL })))
    filaSub.push(subcabecera('N° ATC'), subcabecera('N° ATD'))

    filas.push(filaDias, filaSub)

    // --- Solo los servicios que tienen algún valor en esta semana ---
    // Evita filas completamente vacías (todas sus celdas de la semana en 0).
    const clavesSemana = claves.filter((clave) =>
      semana.some(
        (d) => (porDia.get(`${anio}-${pad(mes)}-${pad(d)}`)?.get(clave) ?? 0) > 0,
      ),
    )

    // --- Una fila por servicio con datos en la semana ---
    for (const clave of clavesSemana) {
      const fila: Row = [etiqueta(etiquetas.get(clave)!.abrev)]
      let semanalATC = 0

      for (const d of semana) {
        const fecha = `${anio}-${pad(mes)}-${pad(d)}`
        const valor = porDia.get(fecha)?.get(clave) ?? 0
        semanalATC += valor
        // Gris si el día no tiene ningún servicio rellenado; blanco si tiene al menos uno.
        const fondo = diasConDatos.has(fecha) ? BLANCO : GRIS_VACIO
        // ATC y ATD son iguales (así lo define el negocio). 0 = celda sin texto.
        fila.push(
          celdaNumero(valor, { backgroundColor: fondo }),
          celdaNumero(valor, { backgroundColor: fondo }),
        )
      }

      fila.push(celdaNumero(semanalATC), celdaNumero(semanalATC))
      mensualATC += semanalATC
      mensualATD += semanalATC

      filas.push(fila)
    }

    filas.push([{ value: '' }])
  }

  // --- Total mensual ---
  const estiloTotal: Partial<CellObject> = {
    backgroundColor: GRIS,
    fontWeight: 'bold',
    ...borde,
  }
  filas.push([
    ...celdasSpan({ value: 'Total mensual', columnSpan: MAX_COLS - 2, align: 'right', ...estiloTotal }),
    numero(mensualATC, estiloTotal),
    numero(mensualATD, estiloTotal),
  ])

  // --- Leyenda ---
  filas.push([{ value: '' }])
  filas.push(celdasSpan({ value: 'Leyenda', columnSpan: MAX_COLS, fontWeight: 'bold', textColor: TEXTO }))
  filas.push(
    celdasSpan({
      value: 'N° ATC = número de atenciones   |   N° ATD = número de atendidos',
      columnSpan: MAX_COLS,
      textColor: GRIS_TEXTO,
    }),
  )
  for (const clave of claves) {
    const info = etiquetas.get(clave)!
    // Solo se listan los servicios que tienen una abreviatura propia.
    if (!info.tieneAbrev) continue
    filas.push(
      celdasSpan({
        value: `${info.abrev} = ${info.nombre}`,
        columnSpan: MAX_COLS,
        textColor: GRIS_TEXTO,
      }),
    )
  }

  return filas
}

/* -------------------------------------------------------------------------- */
/*  Exportación                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Genera y descarga el Excel "Consolidado de atenciones" para el mes indicado.
 * Se ejecuta en el navegador; `write-excel-file` se carga bajo demanda.
 */
export async function exportarConsolidado(datos: DatosConsolidado): Promise<void> {
  const writeXlsxFile = (await import('write-excel-file/browser')).default

  const filas = construirFilas(datos)
  const columns = [
    { width: 22 },
    ...Array.from({ length: MAX_COLS - 1 }, () => ({ width: 9 })),
  ]

  const nombreArchivo = `Consolidado ${MESES_NOMBRE[datos.mes - 1]} ${datos.anio}.xlsx`

  await writeXlsxFile(filas, { sheet: 'Consolidado', columns }).toFile(nombreArchivo)
}
