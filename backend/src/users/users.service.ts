import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async register(dto: CreateUserDto) {
    // 1. Sprawdź czy mail lub nick już istnieje
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { nickname: dto.nickname }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('Użytkownik o takim mailu lub nicku już istnieje!');
    }

    // 2. Hashuj hasło
    const hashedPassword = await argon2.hash(dto.password);

    // 3. Zapisz w bazie
    return this.prisma.user.create({
      data: {
        email: dto.email,
        nickname: dto.nickname,
        password: hashedPassword,
      },
      select: { id: true, nickname: true, email: true } // Nie zwracaj hasła w odpowiedzi!
    });
  }
}