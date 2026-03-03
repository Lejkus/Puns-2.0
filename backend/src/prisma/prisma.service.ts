import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ SUKCES: Prisma 6 połączona z MongoDB!');
    } catch (e) {
      console.error('❌ Błąd:', e.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}