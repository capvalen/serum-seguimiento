import { unzipSync, strFromU8 } from 'fflate'
import { writeFileSync } from 'fs'

let cap = null
globalThis.URL.createObjectURL = (b) => { cap = b; return 'blob:x' }
globalThis.URL.revokeObjectURL = () => {}
globalThis.document = {
  createElement: () => ({ style: {}, click() {}, remove() {} }),
  body: { appendChild() {}, removeChild() {} },
}

const { exportarConsolidado } = await import('/tmp/ce.mjs')

const catalogo = [
  { servicio: 'triaje', abreviatura: '' },
  { servicio: 'tuberculosis', abreviatura: 'tb' },
]
const reporte = {
  mes: '2026-02',
  total: 20,
  dias: { '2026-02-15': 20 },
  detalle: { '2026-02-15': { Triaje: 13, Tuberculosis: 7 } },
  servicios: { Triaje: 13, Tuberculosis: 7 },
}

// Caso 1: con centro de salud.
await exportarConsolidado({
  mes: 2,
  anio: 2026,
  reporte,
  catalogo,
  establecimiento: {
    anio: 'Año de la Esperanza y el Fortalecimiento de la Democracia',
    centroSalud: 'C.S. San Juan',
    tipoSerum: 'remunerada',
  },
})
let files = unzipSync(new Uint8Array(await cap.arrayBuffer()))
let sst = strFromU8(files['xl/sharedStrings.xml'])
let cab = [...sst.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).slice(0, 4)
writeFileSync('/tmp/h1.txt', JSON.stringify(cab, null, 0))

// Caso 2: sin centro de salud.
await exportarConsolidado({
  mes: 2,
  anio: 2026,
  reporte,
  catalogo,
  establecimiento: {
    anio: 'Año de la Esperanza y el Fortalecimiento de la Democracia',
    centroSalud: '',
    tipoSerum: 'equivalente',
  },
})
files = unzipSync(new Uint8Array(await cap.arrayBuffer()))
sst = strFromU8(files['xl/sharedStrings.xml'])
cab = [...sst.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]).slice(0, 3)
writeFileSync('/tmp/h2.txt', JSON.stringify(cab, null, 0))
console.log('OK')
