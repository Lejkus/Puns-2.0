import { Controller, Get, Post, Body } from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll() {
    return this.roomsService.getAllRooms();
  }

  @Post()
  create(@Body() data: { name: string; password?: string }) {
    return this.roomsService.createRoom(data.name, data.password);
  }
}
