import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const apiRoot = join(projectRoot, 'api')

/**
 * Serve the `api/` functions during `vite dev`.
 *
 * WHY THIS EXISTS
 * These routes are Vercel serverless functions, and the obvious way to run them
 * locally is `vercel dev` - which is what the comment in `.env.local` suggests.
 * It does not work here. `vercel.json` carries a catch-all rewrite
 * (`/(.*)` -> `/index.html`) so client routes survive a refresh, and `vercel dev`
 * applies that rewrite to the framework's OWN dev requests too: `/src/main.jsx`,
 * `@vite/client` and every module come back as `index.html` with a
 * `text/html` content type. The browser refuses to execute HTML as a module, so
 * the app never mounts and the page stays blank - a failure that looks like a
 * broken build rather than a rewrote asset.
 *
 * Running the handlers from Vite's own middleware stack sidesteps the rewrite
 * entirely, and has the side benefit that a change to an `api/` file is picked
 * up on the next request without restarting anything.
 *
 * The handlers are written against plain Node primitives (`res.statusCode`,
 * `res.setHeader`, `res.end`, `req.method`, `req.headers`, and an async-iterable
 * body), so Vite's Connect `req`/`res` can be handed over untouched. Nothing is
 * translated, which is what keeps this small and keeps the local behaviour
 * honest: the same code path that runs on Vercel runs here.
 */

/** Every handler file under `api/`, mapped from its URL path. */
function routeTable(dir = apiRoot, found = new Map()) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      // `_lib` is shared code, not a route - Vercel never exposes it either.
      if (entry.startsWith('_')) continue
      routeTable(full, found)
    } else if (entry.endsWith('.js')) {
      const url = '/' + relative(projectRoot, full).split(sep).join('/').replace(/\.js$/, '')
      found.set(url, full)
    }
  }
  return found
}

function apiDevServer(mode) {
  return {
    name: 'local-api-functions',
    apply: 'serve',
    configureServer(server) {
      // Vite only exposes VITE_-prefixed variables on `import.meta.env`, so
      // DATABASE_URL has to be read from the environment and handed over the
      // same way the Vercel runtime would.
      const env = loadEnv(mode, projectRoot, '')
      for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith('VITE_') && process.env[key] === undefined) process.env[key] = value
      }

      const routes = routeTable()
      // Cache-busting so an edited handler is re-imported instead of served from
      // Node's module cache.
      let generation = 0

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const path = url.pathname.replace(/\/+$/, '')
        if (!path.startsWith('/api/')) return next()

        const file = routes.get(path)
        if (!file) return next()

        /*
         * Vercel hands a handler a parsed `req.query`; Node's IncomingMessage has
         * no such property. Every parameterised route here (member, member-row,
         * public-member) reads `req.query`, so without this they each answer
         * "A member number is required" no matter what the URL actually said -
         * a failure that looks like a frontend bug and is not one. Repeated keys
         * collapse into an array, the way Vercel does it.
         */
        const query = {}
        for (const [key, value] of url.searchParams) {
          query[key] = key in query ? [].concat(query[key], value) : value
        }
        req.query = query

        try {
          generation += 1
          const mod = await import(`${pathToFileURL(file).href}?v=${generation}`)
          if (typeof mod.default !== 'function') {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ code: 'BAD_ROUTE', message: `${path} has no default export.` }))
            return
          }
          await mod.default(req, res)
        } catch (error) {
          server.config.logger.error(`[api] ${path} failed: ${error?.stack ?? error}`)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ code: 'HANDLER_CRASHED', message: String(error?.message ?? error) }))
          } else {
            res.end()
          }
        }
      })

      server.config.logger.info(
        `  \u001b[32m\u279c\u001b[39m  \u001b[1mAPI\u001b[22m:    ${routes.size} functions mounted from api/`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), apiDevServer(mode)],
}))
