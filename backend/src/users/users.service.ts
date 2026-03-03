// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createTestUser() {
    console.log('Próbuję utworzyć użytkownika...'); // Dodaj to, żeby widzieć w logach czy funkcja w ogóle ruszyła
    const user = await this.prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        nickname: 'Tester',
        password: 'haslo'
      },
    });
    console.log('Użytkownik utworzony!'); 
    return user;
  }
}