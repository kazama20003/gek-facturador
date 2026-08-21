import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration. The datasource URL is no longer read from
 * schema.prisma; the Schema Engine (migrate) reads it from here, while the
 * runtime client wires the Postgres driver adapter in PrismaService.
 *
 * The URL is read directly from the environment (not via `env()`) so the
 * config still loads for commands that don't touch the database — e.g.
 * `prisma generate` in `postinstall`, which must not require DATABASE_URL.
 * Migrate commands fail with a clear error if the URL is missing.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
