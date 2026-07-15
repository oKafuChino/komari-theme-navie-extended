import { createWriteStream } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import archiver from 'archiver'

const root = resolve(import.meta.dirname, '..')
const source = await readFile(resolve(root, 'src/utils/threeNetworkTargets.ts'), 'utf8')
const output = resolve(root, 'release/three-network-tcp-targets.xlsx')

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

function columnName(index) {
  let value = ''
  for (let current = index + 1; current > 0; current = Math.floor((current - 1) / 26))
    value = String.fromCharCode(65 + (current - 1) % 26) + value
  return value
}

function inlineCell(column, row, value, style = 0) {
  return `<c r="${columnName(column)}${row}" t="inlineStr" s="${style}"><is><t>${xml(value)}</t></is></c>`
}

function numberCell(column, row, value, style = 0) {
  return `<c r="${columnName(column)}${row}" t="n" s="${style}"><v>${value}</v></c>`
}

const provinceMatch = source.match(/const PROVINCES = Object\.freeze\(\[([\s\S]*?)\]\s+as const\)/)
const carrierMatch = source.match(/const CARRIERS = Object\.freeze\(\[([\s\S]*?)\]\s+as const\)/)
if (!provinceMatch || !carrierMatch)
  throw new Error('Unable to read the Three Network TCP target catalog')

const entries = text => [...text.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)].map(([, code, name]) => ({ code, name }))
const provinces = entries(provinceMatch[1])
const carriers = entries(carrierMatch[1])
if (provinces.length !== 31 || carriers.length !== 3)
  throw new Error('Unexpected Three Network TCP catalog size')

const headers = ['序号', '省份代码', '省份', '运营商代码', '运营商', '域名', '端口', 'TCP 测试地址']
const rows = provinces.flatMap(province => carriers.map((carrier) => {
  const host = `${province.code}-${carrier.code}-v4.ip.zstaticcdn.com`
  return [province.code, province.name, carrier.code, carrier.name, host, 80, `${host}:80`]
}))

const sheetRows = [
  `<row r="1">${headers.map((header, index) => inlineCell(index, 1, header, 1)).join('')}</row>`,
  ...rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 2
    const values = [rowIndex + 1, ...row]
    return `<row r="${excelRow}">${values.map((value, index) => typeof value === 'number'
      ? numberCell(index, excelRow, value)
      : inlineCell(index, excelRow, value)).join('')}</row>`
  }),
]

const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/><col min="3" max="3" width="14" customWidth="1"/><col min="4" max="4" width="14" customWidth="1"/><col min="5" max="5" width="12" customWidth="1"/><col min="6" max="6" width="43" customWidth="1"/><col min="7" max="7" width="10" customWidth="1"/><col min="8" max="8" width="48" customWidth="1"/></cols><sheetData>${sheetRows.join('')}</sheetData><autoFilter ref="A1:H94"/></worksheet>`

const files = {
  '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="三网 TCP 目标" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml': sheet,
}

await mkdir(dirname(output), { recursive: true })
await new Promise((resolvePromise, reject) => {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = createWriteStream(output)
  stream.on('close', resolvePromise)
  stream.on('error', reject)
  archive.on('error', reject)
  archive.pipe(stream)
  for (const [name, content] of Object.entries(files))
    archive.append(content, { name })
  void archive.finalize()
})

console.log(`Exported ${rows.length} targets to ${output}`)
