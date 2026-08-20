// ----------------------------------------------------------------------------
//  Prisma 7 configuration.
//  In Prisma 7 the connection URL no longer lives in schema.prisma — the CLI
//  (migrate / db / studio) reads it from here, and the runtime PrismaClient is
//  constructed with a driver adapter (see src/config/prisma.ts).
// ----------------------------------------------------------------------------
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    // Prisma 7 moved the seed command out of package.json into this config.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Used only by CLI commands (migrate/db/studio). Undefined is fine for
    // offline commands like `validate`/`generate`; `migrate` requires it set.
    url: process.env.DATABASE_URL,
  },
})
