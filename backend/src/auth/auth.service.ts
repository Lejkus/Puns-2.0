import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  async login(email: string, pass: string) {
    // 1. Szukamy gościa w bazie
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Błędny email lub hasło');
    }

    // 2. Sprawdzamy czy hasło pasuje do hasha
    const isPasswordValid = await argon2.verify(user.password, pass);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Błędny email lub hasło');
    }

    // 3. Generujemy bilet (JWT)
    const payload = { sub: user.id, nickname: user.nickname };
    
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email
      }
    };
  }
}