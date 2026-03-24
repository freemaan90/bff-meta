import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ChatItemDto, ChatListResponseDto } from './dto/chat-list-response.dto';
import { MessageItemDto, MessageListResponseDto } from './dto/message-list-response.dto';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  async listChats(
    tenantId: string,
    page: number,
    limit: number,
  ): Promise<ChatListResponseDto> {
    const [incomingGroups, messageGroups] = await Promise.all([
      this.prisma.incomingMessage.groupBy({
        by: ['from'],
        where: { tenantId },
        _count: { id: true },
        _max: { createdAt: true },
      }),
      this.prisma.message.groupBy({
        by: ['phone'],
        where: { tenantId },
        _count: { id: true },
        _max: { createdAt: true },
      }),
    ]);

    // Build merged map: phone -> { messageCount, lastMessageAt }
    const chatMap = new Map<string, { messageCount: number; lastMessageAt: Date }>();

    for (const g of incomingGroups) {
      chatMap.set(g.from, {
        messageCount: g._count.id,
        lastMessageAt: g._max.createdAt as Date,
      });
    }

    for (const g of messageGroups) {
      const existing = chatMap.get(g.phone);
      const gMax = g._max.createdAt as Date;
      if (existing) {
        existing.messageCount += g._count.id;
        if (gMax > existing.lastMessageAt) {
          existing.lastMessageAt = gMax;
        }
      } else {
        chatMap.set(g.phone, {
          messageCount: g._count.id,
          lastMessageAt: gMax,
        });
      }
    }

    // Sort by lastMessageAt DESC
    const sorted: ChatItemDto[] = Array.from(chatMap.entries())
      .map(([phone, data]) => ({
        id: phone,
        lastMessageAt: data.lastMessageAt,
        messageCount: data.messageCount,
      }))
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

    const total = sorted.length;
    const skip = (page - 1) * limit;
    const data = sorted.slice(skip, skip + limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getChatMessages(
    tenantId: string,
    phone: string,
    page: number,
    limit: number,
  ): Promise<MessageListResponseDto> {
    const [incomingMessages, outboundMessages] = await Promise.all([
      this.prisma.incomingMessage.findMany({
        where: { tenantId, from: phone },
      }),
      this.prisma.message.findMany({
        where: { tenantId, phone },
      }),
    ]);

    const inbound: MessageItemDto[] = incomingMessages.map((m) => ({
      id: m.id,
      direction: 'inbound',
      type: m.type,
      text: m.text ?? undefined,
      createdAt: m.createdAt,
    }));

    const outbound: MessageItemDto[] = outboundMessages.map((m) => ({
      id: m.id,
      direction: 'outbound' as const,
      type: 'text',
      status: m.status,
      createdAt: m.createdAt,
    }));

    // Merge and sort by createdAt ASC
    const merged = [...inbound, ...outbound].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const total = merged.length;
    const skip = (page - 1) * limit;
    const data = merged.slice(skip, skip + limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
