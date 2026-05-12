import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { GameGateway } from './game/game.gateway';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, RoomsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService, GameGateway],
})
export class AppModule {}
