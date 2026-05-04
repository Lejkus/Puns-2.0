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

@WebSocketGateway({
  cors: {
    origin: '*', // W produkcji dajemy konkretny adres frontu
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // 🔥 PAMIĘĆ RAM: Przechowuje aktualny stan płótna dla każdego pokoju
  private canvasStates = new Map<string, Record<number, string>>();

  handleConnection(client: Socket) {
    console.log(`Gracz połączony: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Gracz rozłączony: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; password?: string },
  ) {
    // Opuszczamy inne pokoje (oprócz własnego ID)
    Array.from(client.rooms).forEach((room) => {
      if (room !== client.id) client.leave(room);
    });

    client.join(data.roomId);
    console.log(`Gracz ${client.id} dołączył do: ${data.roomId}`);

    // Powiadom innych w pokoju o nowym graczu
    this.server.to(data.roomId).emit('messageUpdate', {
      user: 'SYSTEM',
      text: `Nowy gracz dołączył do pokoju!`,
    });

    // 🔥 POBIERANIE STANU: Sprawdzamy, czy pokój ma już jakiś rysunek w pamięci
    const currentState = this.canvasStates.get(data.roomId) || {};
    
    // Wysyłamy stan płótna TYLKO do gracza, który właśnie dołączył (pozwala to na F5)
    client.emit('canvasInit', currentState);
  }

  @SubscribeMessage('draw')
  handleDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { index: number; color: string; roomId: string },
  ) {
    // 1. Wysyłamy rysunek do pozostałych osób w tym samym pokoju (używamy broadcast, żeby nie cofać do nadawcy)
    client.broadcast.to(data.roomId).emit('drawUpdate', data);

    // 2. 🔥 ZAPIS W PAMIĘCI: Aktualizujemy stan płótna dla tego pokoju
    if (!this.canvasStates.has(data.roomId)) {
      this.canvasStates.set(data.roomId, {});
    }
    const state = this.canvasStates.get(data.roomId);
    if (state) {
      state[data.index] = data.color;
    }
  }

  @SubscribeMessage('clear')
  handleClear(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string } // Dodaliśmy oczekiwanie na roomId!
  ) {
    console.log(`🧹 Otrzymano żądanie czyszczenia płótna w pokoju: ${data.roomId}`);
    
    // 1. Czyścimy płótno u wszystkich w DANYM POKOJU
    this.server.to(data.roomId).emit('clearCanvas');
    
    // 2. 🔥 CZYŚCIMY PAMIĘĆ: Resetujemy zapisany stan w RAMie dla tego pokoju
    this.canvasStates.set(data.roomId, {});
  }

  // 🔥 DODANO OBSŁUGĘ CZATU: Wcześniej brakowało tego w Twoim kodzie, a jest niezbędne do działania Chat.tsx
  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { user: string; text: string; roomId: string },
  ) {
    this.server.to(data.roomId).emit('messageUpdate', data);
  }
}