import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { WordsService } from './words.service';
import { RoomsModule } from '../rooms/rooms.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RoomsModule,PrismaModule], // Importujemy RoomsModule, żeby mieć dostęp do RoomsService
  providers: [GameGateway, GameService, WordsService], // Rejestrujemy nasze klasy
})
export class GameModule {}