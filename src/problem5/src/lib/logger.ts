import { config } from '../config.js'

type Level = 'info' | 'error'

const silent = config.LOG_LEVEL === 'silent'

function write(level: Level, message: string, meta?: Record<string, unknown>) {
  if (silent && level !== 'error') return
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`
  const sink = level === 'error' ? console.error : console.log
  if (meta && Object.keys(meta).length > 0) sink(line, meta)
  else sink(line)
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
}
