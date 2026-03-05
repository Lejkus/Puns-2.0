import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';   
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { GameGateway } from './game/game.gateway';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule], 
  controllers: [AppController],
  providers: [AppService, PrismaService,GameGateway],
})
export class AppModule {}