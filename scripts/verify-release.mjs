import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const releaseDir = resolve(root, 'release')
const verifyModelPack = process.argv.includes('--model-pack')
const themeArchivePattern = /^komari-theme-naive-extended-build-.+\.zip$/
const modelArchiveName = 'komari-live2d-model-pack-template.zip'
const requiredThemeEntries = [
  'komari-theme.json',
  'preview.png',
  'dist/index.html',
  'dist/maps/china-with-hk-macau-taiwan.geo.json',
  'dist/live2d/runtime/live2dcubismcore.min.js',
]
const requiredModelEntries = [
  'komari-theme.json',
  'preview.png',
  'dist/index.html',
  'dist/model/README.txt',
]
const forbiddenModelAsset = /\.(?:moc3|model3\.json|motion3\.json|exp3\.json|wav|mp3|ogg)$/i

function listArchiveEntries(archivePath) {
  return execFileSync('tar', ['-tf', archivePath], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
}

function requireEntries(entries, required, archiveName) {
  for (const entry of required) {
    if (!entries.includes(entry))
      throw new Error(`${archiveName} is missing required entry: ${entry}`)
  }
}

function findLatestThemeArchive() {
  const archives = readdirSync(releaseDir)
    .filter(name => themeArchivePattern.test(name))
    .map(name => ({ name, path: resolve(releaseDir, name) }))
    .sort((left, right) => statSync(right.path).mtimeMs - statSync(left.path).mtimeMs)
  if (archives.length === 0)
    throw new Error(`No main theme archive found in ${releaseDir}`)
  return archives[0]
}

function verifyArchive(path, name, required) {
  const entries = listArchiveEntries(path)
  requireEntries(entries, required, name)
  return entries
}

const theme = findLatestThemeArchive()
verifyArchive(theme.path, theme.name, requiredThemeEntries)

if (verifyModelPack) {
  const modelPath = resolve(releaseDir, modelArchiveName)
  const modelEntries = verifyArchive(modelPath, modelArchiveName, requiredModelEntries)
  const leakedAsset = modelEntries.find(entry => forbiddenModelAsset.test(entry))
  if (leakedAsset)
    throw new Error(`${modelArchiveName} must not include model asset: ${leakedAsset}`)
}

console.log(`[release-verify] verified ${theme.name}`)
if (verifyModelPack)
  console.log(`[release-verify] verified ${modelArchiveName}`)
