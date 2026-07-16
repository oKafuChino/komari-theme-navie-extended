import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const packRoot = resolve(root, 'packaging/live2d-model-pack')
const releaseDir = resolve(root, 'release')
const outputPath = resolve(releaseDir, 'komari-live2d-model-pack-template.zip')
const requiredInputs = [
  resolve(packRoot, 'komari-theme.json'),
  resolve(packRoot, 'preview.png'),
  resolve(packRoot, 'dist'),
]

const missingInputs = requiredInputs.filter(path => !existsSync(path))
if (missingInputs.length > 0)
  throw new Error(`[live2d-model-pack] Missing release input: ${missingInputs.join(', ')}`)

mkdirSync(releaseDir, { recursive: true })

const output = createWriteStream(outputPath)
const archive = archiver('zip', { zlib: { level: 9 } })

await new Promise((resolvePromise, reject) => {
  output.on('close', resolvePromise)
  output.on('error', reject)
  archive.on('error', reject)
  archive.pipe(output)
  archive.file(requiredInputs[0], { name: 'komari-theme.json' })
  archive.file(requiredInputs[1], { name: 'preview.png' })
  archive.directory(requiredInputs[2], 'dist')
  void archive.finalize()
})

console.log(`[live2d-model-pack] Created ${outputPath}`)
