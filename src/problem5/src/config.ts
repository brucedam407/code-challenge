import { z } from 'zod'

try {
  process.loadEnvFile()
} catch {
  // No .env file, which is the usual case: every setting has a default.
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4001),
  DATABASE_FILE: z.string().min(1).default('./data/app.db'),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().max(1000).default(100),
  // Creating users is the one write a stranger can repeat without limit.
  CREATE_RATE_LIMIT: z.coerce.number().int().positive().max(10_000).default(10),
  CREATE_RATE_WINDOW_SECONDS: z.coerce.number().int().positive().max(3600).default(60),
  LOG_LEVEL: z.enum(['info', 'silent']).default('info'),
})

export type Config = z.infer<typeof envSchema>

function load(): Config {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${details}`)
  }
  return parsed.data
}

export const config = load()
