import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

import { getDbConfig } from './src/db/config.ts'

config({ path: ['.env.local', '.env'] })

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: getDbConfig(),
})
