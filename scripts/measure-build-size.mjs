import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'

async function collectFiles(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      result.push(...await collectFiles(path))
    }
    else if (['.js', '.css'].includes(extname(entry.name))) {
      result.push(path)
    }
  }
  return result.sort()
}

function argument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

const dist = resolve('dist')
const files = await collectFiles(dist)
const gzipBytes = (await Promise.all(files.map(async path => gzipSync(await readFile(path)).byteLength)))
  .reduce((sum, size) => sum + size, 0)
const result = { gzipBytes, files: files.map(path => path.replace(`${dist}\\`, '').replace(`${dist}/`, '')) }
const writePath = argument('--write')
const comparePath = argument('--compare')

if (writePath) {
  await mkdir(dirname(resolve(writePath)), { recursive: true })
  await writeFile(resolve(writePath), `${JSON.stringify(result, null, 2)}\n`)
}

if (comparePath) {
  const baseline = JSON.parse(await readFile(resolve(comparePath), 'utf8'))
  const maxIncrease = Number(argument('--max-increase'))
  const increase = gzipBytes - baseline.gzipBytes
  console.log(JSON.stringify({ baseline: baseline.gzipBytes, current: gzipBytes, increase, maxIncrease }))
  if (!Number.isFinite(maxIncrease) || increase > maxIncrease)
    process.exitCode = 1
}
else {
  console.log(JSON.stringify(result))
}
