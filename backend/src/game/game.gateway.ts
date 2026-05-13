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

interface Player {
  id: string; // Socket ID
  userId: string; // ID z bazy danych
  nickname: string;
  isHost: boolean;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Mapy w RAMie
  private canvasStates = new Map<string, Record<number, string>>();
  private roomPlayers = new Map<string, Player[]>();

  // 🔥 NOWOŚĆ: Śledzenie aktywnych sesji (userId -> socketId)
  private activeUsers = new Map<string, string>();

  constructor(
    private readonly roomsService: RoomsService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    // Odczytujemy userId przekazane z frontendu
    const userId = client.handshake.auth.userId;

    if (userId) {
      const oldSocketId = this.activeUsers.get(userId);

      // Jeśli user już ma socket i to nie jest ten sam socket (np. nowa karta)
      if (oldSocketId && oldSocketId !== client.id) {
        const oldSocket = this.server.sockets.sockets.get(oldSocketId);

        if (oldSocket) {
          console.log(`Wykopuję starą sesję użytkownika: ${userId}`);
          // Wysyłamy sygnał do starego urządzenia/karty
          oldSocket.emit('force_logout', {
            reason: 'Zalogowano z innego urządzenia. Zostałeś wylogowany.',
          });
          // Rozłączamy stary socket po stronie serwera
          oldSocket.disconnect();
        }
      }

      // Zapisujemy nowe połączenie
      this.activeUsers.set(userId, client.id);
    }

    console.log(`Gracz połączony: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // 1. Usuwamy użytkownika z globalnej mapy sesji
    for (const [userId, socketId] of this.activeUsers.entries()) {
      if (socketId === client.id) {
        this.activeUsers.delete(userId);
        break;
      }
    }

    // 2. Twoja obecna logika usuwania z pokojów i przekazywania Hosta
    this.roomPlayers.forEach((players, roomId) => {
      const playerIndex = players.findIndex((p) => p.id === client.id);
      if (playerIndex !== -1) {
        const wasHost = players[playerIndex].isHost;
        players.splice(playerIndex, 1);

        if (players.length > 0) {
          if (wasHost) players[0].isHost = true;
          this.server.to(roomId).emit('playersUpdate', players);
        } else {
          this.roomPlayers.delete(roomId);
          this.canvasStates.delete(roomId);
        }
      }
    });

    console.log(`Gracz rozłączony: ${client.id}`);
  }

  // --- CZAT (Wrócił na swoje miejsce!) ---
  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { user: string; text: string },
  ) {
    const roomId = Array.from(client.rooms).find((r) => r !== client.id);
    if (roomId) {
      this.server.to(roomId).emit('messageUpdate', data);
      console.log(`[Chat] ${roomId} | ${data.user}: ${data.text}`);
    }
  }

  // --- DOŁĄCZANIE DO POKOJU ---
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: string;
      password?: string;
      nickname: string;
      userId: string;
    },
  ) {
    const { roomId, password, nickname, userId } = data;

    if (!roomId || !userId) {
      client.emit(
        'error_message',
        'Błąd: Dane pokoju i użytkownika są wymagane!',
      );
      return;
    }

    // 1. Sprawdzamy czy gra już nie trwa
    const room = await this.prisma.room.findUnique({ where: { name: roomId } });
    if (room && room.status === 'IN_GAME') {
      client.emit('error_message', 'Nie można dołączyć – gra już trwa!');
      return;
    }

    // 2. Walidacja hasła
    const isAuthorized = await this.roomsService.verifyRoomPassword(
      roomId,
      password,
    );
    if (!isAuthorized) {
      client.emit('error_message', 'Nieprawidłowe hasło do pokoju!');
      return;
    }

    // 3. 🔥 LOGIKA PROFESJONALNA: Kick starej sesji
    const oldSocketId = this.activeUsers.get(userId);
    if (oldSocketId && oldSocketId !== client.id) {
      const oldSocket = this.server.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        // 🔥 Wysyłamy sygnał do całkowitego wylogowania frontendu
        oldSocket.emit('force_logout', {
          reason: 'Zalogowano się na innym urządzeniu.',
        });
        oldSocket.disconnect();
      }
    }
    this.activeUsers.set(userId, client.id);

    // 4. Izolacja pokoju
    Array.from(client.rooms).forEach((r) => {
      if (r !== client.id) client.leave(r);
    });
    client.join(roomId);

    // 5. Zarządzanie listą graczy
    let players = this.roomPlayers.get(roomId) || [];
    const isHost = players.length === 0;

    const newPlayer: Player = {
      id: client.id,
      userId: userId,
      nickname: nickname || 'Anonim',
      isHost,
    };

    players.push(newPlayer);
    this.roomPlayers.set(roomId, players);

    // 6. Sync z resztą graczy
    this.server.to(roomId).emit('playersUpdate', players);
    client.emit('joinSuccess', { roomId, isHost });

    // Wysłanie aktualnego stanu rysunku
    const currentState = this.canvasStates.get(roomId) || {};
    client.emit('canvasInit', currentState);
  }

  // --- SILNIK RYSOWANIA ---
  @SubscribeMessage('draw')
  handleDraw(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const roomId = Array.from(client.rooms).find((r) => r !== client.id);
    if (roomId) {
      client.broadcast.to(roomId).emit('drawUpdate', data);
      if (!this.canvasStates.has(roomId)) this.canvasStates.set(roomId, {});
      const state = this.canvasStates.get(roomId);
      if (state) state[data.index] = data.color;
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

  // --- START GRY ---
  @SubscribeMessage('startGame')
  async handleStartGame(@MessageBody() data: { roomId: string }) {
    await this.prisma.room.update({
      where: { name: data.roomId },
      data: { status: 'IN_GAME' },
    });
    this.server.to(data.roomId).emit('gameStarted');
  }
}
