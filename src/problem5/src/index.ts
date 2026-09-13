import type { Server } from 'node:http'
import { config } from './config.js'
import { createApp } from './app.js'
import { createDb } from './db/index.js'
import { logger } from './lib/logger.js'

async function main() {
  const db = createDb()
  const app = createApp({ db })

  const server = app.listen(config.PORT, () => {
    logger.info(`listening on http://localhost:${config.PORT}`, { env: config.NODE_ENV })
  })

  installShutdownHandlers(server, async () => {
    db.close()
  })
}

function installShutdownHandlers(server: Server, closeResources: () => Promise<void>) {
  let shuttingDown = false

  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`${signal} received, shutting down`)

    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out after 10s, exiting anyway')
      process.exit(1)
    }, 10_000)
    forceExit.unref()

    server.close(async (error) => {
      if (error) logger.error('http server failed to close', { message: error.message })
      try {
        await closeResources()
      } catch (closeError) {
        logger.error('failed to close resources', {
          message: closeError instanceof Error ? closeError.message : String(closeError),
        })
      }
      process.exit(error ? 1 : 0)
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  logger.error('failed to start', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  process.exit(1)
})
