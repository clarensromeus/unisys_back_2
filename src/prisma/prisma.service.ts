import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connectionError?: unknown;

  async onModuleInit() {
    try {
      await this.$connect();
      this.connectionError = undefined;
    } catch (error) {
      this.connectionError = error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database connection failed. API will keep running, but database-backed requests will fail until Postgres is reachable. ${message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  isDatabaseReady() {
    return !this.connectionError;
  }

  databaseErrorMessage() {
    return this.connectionError instanceof Error ? this.connectionError.message : 'Database is not connected.';
  }
}
