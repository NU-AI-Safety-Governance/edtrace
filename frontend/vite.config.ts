import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const frontendDir = path.dirname(fileURLToPath(import.meta.url))

// The directory holding the lectures (var/traces, images, ...).  Defaults to
// wherever the package manager was invoked from, so running
// `pnpm --dir edtrace/frontend dev` from a lecture repo just works.
const contentDir = path.resolve(
  process.env.EDTRACE_CONTENT_DIR || process.env.INIT_CWD || process.env.PWD || process.cwd(),
)
const isStandalone = contentDir === frontendDir

const MIME_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * Dev: serve lecture files straight out of the content directory and tell the
 * browser to reload a trace whenever it is re-executed.
 * Build: write index.html + assets/ into the content directory (so it can be
 * served from GitHub Pages next to var/ and images/).
 */
function edtraceContent(): Plugin {
  return {
    name: 'edtrace-content',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '/').split('?')[0])
        if (url === '/' || url.endsWith('.html')) return next()
        const file = path.join(contentDir, url)
        // Stay inside the content directory, and never shadow the viewer's own sources
        if (!file.startsWith(contentDir + path.sep) || file.startsWith(frontendDir + path.sep)) return next()
        fs.stat(file, (error, stat) => {
          if (error || !stat.isFile()) return next()
          const type = MIME_TYPES[path.extname(file).toLowerCase()]
          if (type) res.setHeader('Content-Type', type)
          res.setHeader('Cache-Control', 'no-store')
          fs.createReadStream(file).pipe(res)
        })
      })

      const tracesDir = path.join(contentDir, 'var', 'traces')
      server.watcher.add(tracesDir)
      const notify = (file: string) => {
        if (!file.startsWith(tracesDir) || !file.endsWith('.json')) return
        server.ws.send({
          type: 'custom',
          event: 'edtrace:trace-changed',
          data: { path: path.relative(contentDir, file).split(path.sep).join('/') },
        })
      }
      server.watcher.on('change', notify)
      server.watcher.on('add', notify)
    },

    buildStart() {
      // Hashed bundles from previous builds would otherwise pile up
      if (!isStandalone) fs.rmSync(path.join(contentDir, 'assets'), { recursive: true, force: true })
    },
  }
}

export default defineConfig(({ command }) => ({
  // Relative base: the site works from any subpath (e.g. <org>.github.io/<repo>/)
  base: './',
  // Lets a lecture repo set VITE_EDTRACE_SITE_TITLE in its own .env
  envDir: contentDir,
  publicDir: false,
  build: command !== 'build' ? undefined : {
    // Writing into the lecture repo (a parent of this directory) is intentional
    outDir: isStandalone ? 'dist' : contentDir,
    emptyOutDir: isStandalone,
    chunkSizeWarningLimit: 2000,
  },
  plugins: [react(), edtraceContent()],
}))
