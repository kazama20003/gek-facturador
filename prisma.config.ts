import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration. The datasource URL is no longer read from
 * schema.prisma; the Schema Engine (migrate) reads it from here, while the
 * runtime client wires the Postgres driver adapter in PrismaService.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
