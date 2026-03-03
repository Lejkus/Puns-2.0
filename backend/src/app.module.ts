import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module'; // [DODAJ TO]
import { UsersModule } from './users/users.module';   // [DODAJ TO]
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [PrismaModule, UsersModule], // [DODAJ TO]
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}