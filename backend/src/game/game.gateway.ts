import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from '../rooms/rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import { GameService } from './game.service'; // 🔥 IMPORT SERWISU

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private activeUsers = new Map<string, string>();
  private canvasStates = new Map<string, Record<number, string>>();

  constructor(
    private readonly roomsService: RoomsService,
    private readonly prisma: PrismaService,
    private readonly gameService: GameService, // 🔥 WSTRZYKUJEMY SERWIS
  ) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    if (userId) {
      const oldSocketId = this.activeUsers.get(userId);
      if (oldSocketId && oldSocketId !== client.id) {
        const oldSocket = this.server.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.emit('force_logout', {
            reason: 'Zalogowano z innego urządzenia.',
          });
          oldSocket.disconnect();
        }
      }
      this.activeUsers.set(userId, client.id);
    }
  }

  handleDisconnect(client: Socket) {
    // 1. Usuwamy z aktywnych sesji
    for (const [userId, socketId] of this.activeUsers.entries()) {
      if (socketId === client.id) {
        this.activeUsers.delete(userId);
        break;
      }
    }

    // 2. Oddajemy logikę pokojów do Serwisu
    const updatedRoomId = this.gameService.removePlayer(client.id);
    if (updatedRoomId) {
      const state = this.gameService.getGameState(updatedRoomId);
      this.server.to(updatedRoomId).emit('playersUpdate', state.players);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: string; password?: string; nickname: string },
  ) {
    const { roomId, password, nickname } = data;

    // Walidacje
    const room = await this.prisma.room.findUnique({ where: { name: roomId } });
    if (!room) return client.emit('error_message', 'Taki pokój nie istnieje!');
    if (room.status === 'IN_GAME')
      return client.emit('error_message', 'Gra już trwa!');

    const isAuthorized = await this.roomsService.verifyRoomPassword(
      roomId,
      password,
    );
    if (!isAuthorized)
      return client.emit('error_message', 'Nieprawidłowe hasło!');

    // Blokada klona (teraz pytamy Serwisu)
    const state = this.gameService.getGameState(roomId);
    if (state.players.some((p) => p.nickname === nickname)) {
      return client.emit(
        'error_message',
        'Użytkownik o tym nicku już tu jest!',
      );
    }

    // Dołączamy
    Array.from(client.rooms).forEach((r) => {
      if (r !== client.id) client.leave(r);
    });
    client.join(roomId);

    // Dodajemy do Mózgu Gry
    const userId = client.handshake.auth.userId || client.id;
    const newState = this.gameService.addPlayer(
      roomId,
      client.id,
      userId,
      nickname,
    );

    this.server.to(roomId).emit('playersUpdate', newState.players);
    client.emit('joinSuccess', {
      roomId,
      isHost: newState.players.find((p) => p.id === client.id)?.isHost,
    });

    // Płótno
    const currentState = this.canvasStates.get(roomId) || {};
    client.emit('canvasInit', currentState);
  }

  @SubscribeMessage('startGame')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const state = this.gameService.getGameState(data.roomId);
    const requester = state.players.find((p) => p.id === client.id);
    if (!requester?.isHost) {
      return client.emit('error_message', 'Tylko host może rozpocząć grę!');
    }

    await this.prisma.room.update({
      where: { name: data.roomId },
      data: { status: 'IN_GAME' },
    });

    // Przełączamy widok na froncie
    this.server.to(data.roomId).emit('gameStarted');

    // 🔥 ODPALAMY MÓZG GRY!
    this.gameService.startGame(data.roomId, this.server);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { user: string; text: string },
  ) {
    // 1. Znajdujemy pokój
    const roomId = Array.from(client.rooms).find((r) => r !== client.id);
    if (!roomId) return;

    const state = this.gameService.getGameState(roomId);
    if (!state) return;

    // 2. BLOKADA DLA RYSOWNIKA: Nie pozwalamy mu pisać, gdy gra trwa i to jego tura
    if (state.status === 'PLAYING' && state.currentDrawerId === client.id) {
      return;
    }

    // 3. Pytamy Mózg Gry, czy to zgadnięcie hasła
    const isCorrectGuess = this.gameService.checkGuess(
      roomId,
      client.id,
      data.text,
      this.server,
    );

    if (isCorrectGuess) {
      // 4. KTOŚ ZGADŁ!
      this.server.to(roomId).emit('messageUpdate', {
        user: 'SYSTEM',
        text: `🟢 ${data.user} odgadł hasło!`,
        isSystem: true, // Dodajemy flagę, żeby łatwiej było stylować na froncie
      });

      // 5. Aktualizujemy listę graczy (nowe punkty i ikonki zgadnięcia)
      this.server.to(roomId).emit('playersUpdate', state.players);
    } else {
      // 7. Zwykła wiadomość (tylko jeśli gra nie trwa LUB nikt nie zgadł)
      this.server.to(roomId).emit('messageUpdate', data);
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    // 1. Najpierw pobieramy nick gracza (ZANIM go usuniemy)
    const state = this.gameService.getGameState(data.roomId);
    const player = state?.players.find((p) => p.id === client.id);

    // 2. Usuwamy go
    client.leave(data.roomId);
    const updatedRoomId = this.gameService.removePlayer(client.id);

    // 3. Wysyłamy wiadomość na czat
    if (player) {
      // Zmieniono receiveMessage -> messageUpdate i sender -> user, aby pasowało do reszty
      this.server.to(data.roomId).emit('messageUpdate', {
        user: 'SYSTEM',
        text: `🛑 ${player.nickname} opuścił(a) grę.`,
        isSystem: true,
      });
    }

    if (updatedRoomId) {
      const newState = this.gameService.getGameState(updatedRoomId);
      this.server.to(updatedRoomId).emit('playersUpdate', newState.players);
    }
  }

  // Draw i Clear zostają bez zmian
  @SubscribeMessage('draw')
  handleDraw(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const roomId = Array.from(client.rooms).find((r) => r !== client.id);
    if (roomId) {
      client.broadcast.to(roomId).emit('drawUpdate', data);
      if (!this.canvasStates.has(roomId)) this.canvasStates.set(roomId, {});
      this.canvasStates.get(roomId)![data.index] = data.color;
    }
  }

  @SubscribeMessage('clear')
  handleClear(@ConnectedSocket() client: Socket) {
    const roomId = Array.from(client.rooms).find((r) => r !== client.id);
    if (roomId) {
      this.server.to(roomId).emit('clearCanvas');
      this.canvasStates.set(roomId, {});
    }
  }
}
