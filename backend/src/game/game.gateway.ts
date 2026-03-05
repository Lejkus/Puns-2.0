import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
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

  handleConnection(client: Socket) {
    console.log(`Gracz połączony: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Gracz rozłączony: ${client.id}`);
  }

  // Zmieniamy oczekiwane dane na 'index' i 'color'
  @SubscribeMessage('draw')
  handleDraw(@MessageBody() data: { index: number; color: string }) {
    // Rozsyłamy do innych graczy (używamy broadcast, żeby nie wysyłać do nadawcy)
    this.server.emit('drawUpdate', data);
  }

  @SubscribeMessage('clear')
  handleClear() {
    console.log('🧹 Otrzymano żądanie czyszczenia płótna');
    // Używamy this.server, aby mieć pewność, że wiadomość leci do KAŻDEGO połączonego klienta
    this.server.emit('clearCanvas');
  }
  
}
