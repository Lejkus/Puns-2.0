import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { PrismaModule } from '../prisma/prisma.module'; // upewnij się, że masz PrismaModule

@Module({
  imports: [PrismaModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService], // Eksportujemy, żeby Gateway mógł sprawdzać hasła
})
export class RoomsModule {}
