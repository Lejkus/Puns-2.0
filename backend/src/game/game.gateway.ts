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
import { RoomsService } from '../rooms/rooms.service'; // Sprawdź czy ścieżka się zgadza!
import { PrismaService } from '../prisma/prisma.service';
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 🔥 PAMIĘĆ RAM: Przechowuje aktualny stan płótna dla każdego pokoju
  private canvasStates = new Map<string, Record<number, string>>();

  // 🔥 KONSTRUKTOR: Wstrzykujemy RoomsService, żeby móc sprawdzać hasła w bazie i potem prisma
  constructor(
    private readonly roomsService: RoomsService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Gracz połączony: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Gracz rozłączony: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any, // Używamy any, żeby bezpiecznie sprawdzić typ danych
  ) {
    // --- DEBUG: Sprawdzamy co przysłał Frontend ---
    console.log('--- Nowa próba dołączenia ---');
    console.log('Dane z frontu:', data);

    // Wyciągamy dane niezależnie od tego, czy to obiekt, czy string
    let roomId: string;
    let password: string | undefined;

    if (typeof data === 'string') {
      // Jeśli frontend wysłał tylko string (stara wersja)
      roomId = data;
      password = undefined;
    } else {
      // Jeśli frontend wysłał obiekt { roomId, password }
      roomId = data.roomId;
      password = data.password;
    }

    // 1. Walidacja: Czy w ogóle mamy nazwę pokoju?
    if (!roomId) {
      console.log('Błąd: Brak nazwy pokoju w żądaniu');
      client.emit('error_message', 'Błąd: Nazwa pokoju jest wymagana!');
      return;
    }

    // SPRADZANIE CZY GRA TEWA
    const room = await this.prisma.room.findUnique({
      where: { name: roomId },
    });

    if (room && room.status === 'IN_GAME') {
      console.log(`ODMOWA: Gra w pokoju ${roomId} już trwa.`);
      client.emit('error_message', 'Nie można dołączyć – gra już trwa!'); // Komunikat dla użytkownika
      return; // Zatrzymujemy funkcję, gracz nie wchodzi do pokoju
    }
    // 2. Sprawdzamy hasło w MongoDB przez nasz serwis
    const isAuthorized = await this.roomsService.verifyRoomPassword(
      roomId,
      password,
    );

    if (!isAuthorized) {
      console.log(
        `ODMOWA: Złe hasło do pokoju: ${roomId} (podano: ${password})`,
      );
      client.emit('error_message', 'Nieprawidłowe hasło do pokoju!');
      return; // Stop - nie wpuszczamy gracza
    }

    // 3. Autoryzacja udana - Czyścimy stare pokoje (żeby gracz był tylko w jednym)
    Array.from(client.rooms).forEach((room) => {
      if (room !== client.id) {
        client.leave(room);
      }
    });

    // 4. Dołączamy do nowego pokoju
    client.join(roomId);
    console.log(`SUKCES: Gracz ${client.id} wszedł do: ${roomId}`);

    // 🔥 NOWOŚĆ: Informujemy konkretnie TEN JEDEN KLIENT, że wszystko jest OK
    client.emit('joinSuccess', { roomId });
    // 5. Powitanie i stan płótna
    this.server.to(roomId).emit('messageUpdate', {
      user: 'SYSTEM',
      text: `Nowy gracz dołączył do pokoju: ${roomId}`,
    });

    const currentState = this.canvasStates.get(roomId) || {};
    client.emit('canvasInit', currentState);
  }

  @SubscribeMessage('draw')
  handleDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { index: number; color: string }, // Już nie potrzebujemy tu roomId!
  ) {
    // 🔥 SZTUCZKA: Pobieramy pokój, w którym aktualnie jest ten klient
    const roomId = Array.from(client.rooms).find((r) => r !== client.id);

    if (roomId) {
      // Wysyłamy do wszystkich w TYM pokoju, oprócz rysującego
      client.broadcast.to(roomId).emit('drawUpdate', data);

      // Zapisujemy stan płótna w RAMie (dla nowych graczy)
      if (!this.canvasStates.has(roomId)) {
        this.canvasStates.set(roomId, {});
      }
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

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { user: string; text: string },
  ) {
    const roomId = Array.from(client.rooms).find((r) => r !== client.id);
    if (roomId) {
      this.server.to(roomId).emit('messageUpdate', data);
    }
  }

  @SubscribeMessage('startGame')
  async handleStartGame(@MessageBody() data: { roomId: string }) {
    // Zmieniamy status w bazie danych
    await this.prisma.room.update({
      where: { name: data.roomId },
      data: { status: 'IN_GAME' },
    });

    // Informujemy wszystkich w pokoju, że zaczynamy!
    this.server.to(data.roomId).emit('gameStarted');
  }
}
