import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { PrismaService } from 'src/prisma/prisma.service';
import { Server, Socket } from 'socket.io'
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';


@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly ONLINE_USERS_KEY = 'online_users';
  private readonly USER_SOCKET_KEY = (userId: number) => `user:${userId}:socket`;
  private readonly SOCKET_USER_KEY = (socketId: string) => `socket:${socketId}:user`;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ){}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET') || 'secret';
      const payload = jwt.verify(token, secret) as any;
      client.data.user = payload;

      const userId = payload.sub;
      if (!userId) {
        client.disconnect();
        return;
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      });

      const pipeline = this.redis.pipeline();
      pipeline.setex(this.USER_SOCKET_KEY(userId), 300, client.id);
      pipeline.setex(this.SOCKET_USER_KEY(client.id), 300, userId.toString());
      pipeline.sadd(this.ONLINE_USERS_KEY, userId.toString());
      await pipeline.exec();

      const boards = await this.prisma.boardMember.findMany({
        where: { userId },
        select: { boardId: true },
      });

      for (const board of boards) {
        client.join(`board:${board.boardId}`);
      }

      client.join(`user:${userId}`);

      this.server.emit('userOnline', {
        userId,
        online: true,
        timestamp: new Date().toISOString(),
      });

    } catch(error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }
  async handleDisconnect(client: Socket) {
    try {
      const userIdString = await this.redis.get(this.SOCKET_USER_KEY(client.id));
      if (!userIdString) return;

      const userId = parseInt(userIdString, 10);

      const pipeline = this.redis.pipeline();
      pipeline.srem(this.ONLINE_USERS_KEY, userId.toString())
      pipeline.del(this.USER_SOCKET_KEY(userId));
      pipeline.del(this.SOCKET_USER_KEY(client.id));
      await pipeline.exec();

      this.server.emit('userOnline', {
        userId,
        online: false,
        timestamp: new Date().toISOString(),
      });
    } catch(error) {
      console.error('Sisconnect error:', error);
    }


  }

  emitBoardUpdated(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('boardUpdated', data);
  }

  emitColumnCreated(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('columnCreated', data);
  }

  emitColumnUpdated(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('columnUpdated', data);
  }

  emitColumnDeleted(boardId: number, data: any){
    this.server.to(`board:${boardId}`).emit('columnDeleted', data);
  }

  emitCardCreated(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('cardCreated', data);
  }

  emitCardUpdated(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('cardUpdated', data);
  }

  emitCardMoved(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('cardMoved', data);
  }

  emitCardDeleted(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('cardDeleted', data);
  }

  emitCommentAdded(boardId: number, data: any) {
    this.server.to(`board:${boardId}`).emit('commentAdded', data);
  }



  // подписки(клиент => сервер)


  @SubscribeMessage('joinBoard')
  async handleJoinBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boardId: number },
  ){
    const userId = client.data.user?.sub;
    if(!userId) return;

    const isMember = await this.prisma.boardMember.findFirst({
      where: { boardId: data.boardId, userId },
    });

    if(isMember) {
      client.join(`board:${data.boardId}`);
      return { success: true };
    }
    return { success: false, message: 'Access denied' };
  }


  @SubscribeMessage('leaveBoard')
  async handleLeaveBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { boardId: number },
  ) {
    if (!Number.isInteger(data?.boardId)) {
      return { success: false, message: 'A valid boardId is required' };
    }

    await client.leave(`board:${data.boardId}`);
    return { success: true };
  }

  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers() {
    const users = await this.redis.smembers(this.ONLINE_USERS_KEY);
    return { users: users.map(Number) };
  }


}
