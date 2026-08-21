import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Placeholder used only so the client constructs when no database is
// configured. The pg pool connects lazily, and the module wires the Prisma
// repositories exclusively when DATABASE_URL is set, so this client is never
// queried against it.
const NO_DATABASE_URL = 'postgresql://localhost:5432/emitec_disabled';

/**
 * Prisma client tied to the Nest lifecycle. Prisma 7 no longer reads the
 * connection URL from the schema and requires an explicit driver adapter, so
 * the Postgres adapter is wired here from DATABASE_URL.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL ?? NO_DATABASE_URL;
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
