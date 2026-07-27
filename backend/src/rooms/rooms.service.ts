import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async createRoom(name: string, password?: string) {
    const existing = await this.prisma.room.findUnique({ where: { name } });
    if (existing) {
      // Rzucamy błąd, jeśli pokój już jest - frontend to wyłapie
      throw new ConflictException('Pokój o tej nazwie już istnieje!');
    }

    return this.prisma.room.create({
      data: { name, password: password || null },
    });
  }

  async verifyRoomPassword(name: string, password?: string): Promise<boolean> {
    const room = await this.prisma.room.findUnique({ where: { name } });
    
    if (!room) return false;

    // Blokada "gra już trwa" jest teraz w GameGateway (i pomija graczy wracających po F5) - tu liczy się tylko hasło
    if (!room.password || room.password === "") return true;
    return room.password === password;
  }

  async getAllRooms() {
    return this.prisma.room.findMany({ where: { status: 'LOBBY' } });
  }
}