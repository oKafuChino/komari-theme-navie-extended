import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'

import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

import vueDevTools from 'vite-plugin-vue-devtools'

// 使用 createRequire 支持 CommonJS 模块
const require = createRequire(import.meta.url)
const fs = require('node:fs')
const archiver = require('archiver')

/**
 * 获取当前 Git commit hash（短格式）
 */
function getCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  }
  catch {
    return 'unknown'
  }
}

interface ZipArchive {
  pointer: () => number
  on: (event: 'error', listener: (error: Error) => void) => ZipArchive
  pipe: (output: NodeJS.WritableStream) => void
  file: (source: string, data: { name: string }) => ZipArchive
  directory: (source: string, destination: string) => ZipArchive
  finalize: () => Promise<void>
}

function createZip(
  outputPath: string,
  displayName: string,
  addEntries: (archive: ZipArchive) => void,
): Promise<void> {
  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } }) as ZipArchive
  return new Promise((resolvePromise, reject) => {
    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2)
      console.log(`[komari-theme-zip] Created ${displayName} (${sizeMB} MB)`)
      resolvePromise()
    })
    output.on('error', reject)
    archive.on('error', reject)
    archive.pipe(output)
    addEntries(archive)
    void archive.finalize()
  })
}

/**
 * Vite 插件：构建后打包 Komari 主题 Zip
 *
 * 生成符合 Komari 标准的主题包结构：
 * theme.zip
 * ├── komari-theme.json    # 主题配置文件
 * ├── preview.png          # 主题预览图
 * └── dist/                # 构建输出目录
 *     ├── index.html
 *     └── ...
 */
function komariThemeZip(): Plugin {
  return {
    name: 'komari-theme-zip',
    apply: 'build',
    closeBundle: async () => {
      const commitHash = getCommitHash()
      const zipFileName = `komari-theme-naive-extended-build-${commitHash}.zip`
      const releaseDir = resolve(__dirname, 'release')
      const distDir = resolve(__dirname, 'dist')
      const themeJsonPath = resolve(__dirname, 'komari-theme.json')
      const previewPath = resolve(__dirname, 'docs/preview.png')
      const outputPath = resolve(releaseDir, zipFileName)
      const modelPackRoot = resolve(__dirname, 'packaging/live2d-model-pack')
      const modelPackManifest = resolve(modelPackRoot, 'komari-theme.json')
      const modelPackPreview = resolve(modelPackRoot, 'preview.png')
      const modelPackDistDir = resolve(modelPackRoot, 'dist')
      const modelPackOutput = resolve(releaseDir, 'komari-live2d-model-pack-template.zip')
      const requiredInputs = [
        distDir,
        themeJsonPath,
        previewPath,
        modelPackManifest,
        modelPackPreview,
        modelPackDistDir,
      ]
      const missingInputs = requiredInputs.filter(path => !existsSync(path))
      if (missingInputs.length > 0)
        throw new Error(`[komari-theme-zip] Missing release input: ${missingInputs.join(', ')}`)

      mkdirSync(releaseDir, { recursive: true })

      await createZip(outputPath, zipFileName, (archive) => {
        archive.file(themeJsonPath, { name: 'komari-theme.json' })
        archive.file(previewPath, { name: 'preview.png' })
        archive.directory(distDir, 'dist')
      })

      await createZip(modelPackOutput, 'komari-live2d-model-pack-template.zip', (archive) => {
        archive.file(modelPackManifest, { name: 'komari-theme.json' })
        archive.file(modelPackPreview, { name: 'preview.png' })
        archive.directory(modelPackDistDir, 'dist')
      })
    },
  }
}

// 读取 package.json 获取版本号
const packageJson = require('./package.json')

// https://vite.dev/config/
export default defineConfig({
  // 定义全局常量，在构建时注入
  define: {
    __BUILD_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_GIT_HASH__: JSON.stringify(getCommitHash()),
  },
  plugins: [
    vue(),
    vueDevTools(),
    UnoCSS(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar',
          ],
        },
      ],
    }),
    Components({
      resolvers: [NaiveUiResolver()],
    }),
    komariThemeZip(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
  },
  build: {
    // 调整 chunk 大小警告阈值
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts': ['echarts', 'vue-echarts'],
          'naive-ui': ['naive-ui'],
          'vueuse': ['@vueuse/core'],
        },
      },
    },
  },
})
