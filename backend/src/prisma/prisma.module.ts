import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Dzięki temu nie musisz importować PrismaModule w każdym innym module
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // To pozwala innym na korzystanie z serwisu
})
export class PrismaModule {}