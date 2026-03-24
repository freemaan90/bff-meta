import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ namespace: '/events', cors: { origin: '*' } })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  afterInit(_server: Server): void {
    this.logger.log('WebSocket gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, tenantId: string): void {
    if (!tenantId) return;
    client.join(tenantId);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, tenantId: string): void {
    client.leave(tenantId);
  }

  emitToTenant(tenantId: string, event: string, payload: object): void {
    if (!this.server) {
      this.logger.warn(
        `emitToTenant called before server init: event=${event}, tenantId=${tenantId}`,
      );
      return;
    }
    this.server.to(tenantId).emit(event, payload);
  }
}
