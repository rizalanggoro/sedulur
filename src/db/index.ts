import { drizzle } from 'drizzle-orm/node-postgres'

import { getDbConfig } from './config.ts'
import * as schema from './schema.ts'

export const db = drizzle({ connection: getDbConfig(), schema })
