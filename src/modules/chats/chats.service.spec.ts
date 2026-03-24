import { Test, TestingModule } from '@nestjs/testing';
import { ChatsService } from './chats.service';
import { PrismaService } from 'src/database/prisma.service';

type PrismaMock = {
  incomingMessage: { groupBy: jest.Mock; findMany: jest.Mock };
  message: { groupBy: jest.Mock; findMany: jest.Mock };
};

const makePrismaMock = (): PrismaMock => ({
  incomingMessage: {
    groupBy: jest.fn().mockResolvedValue([]),
    findMany: jest.fn().mockResolvedValue([]),
  },
  message: {
    groupBy: jest.fn().mockResolvedValue([]),
    findMany: jest.fn().mockResolvedValue([]),
  },
});

let prismaMock: PrismaMock;

describe('ChatsService', () => {
  let service: ChatsService;

  beforeEach(async () => {
    prismaMock = makePrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ChatsService>(ChatsService);
  });

  // ─── listChats ────────────────────────────────────────────────────────────

  describe('listChats', () => {
    it('returns empty list when no messages exist (req 1.4)', async () => {
      const result = await service.listChats('tenant-1', 1, 20);
      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
    });

    it('returns chats from IncomingMessage only (req 1.7)', async () => {
      prismaMock.incomingMessage.groupBy.mockResolvedValue([
        { from: '5491100000001', _count: { id: 3 }, _max: { createdAt: new Date('2024-01-03') } },
      ]);

      const result = await service.listChats('tenant-1', 1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: '5491100000001', messageCount: 3 });
    });

    it('returns chats from Message only (req 1.7)', async () => {
      prismaMock.message.groupBy.mockResolvedValue([
        { phone: '5491100000002', _count: { id: 2 }, _max: { createdAt: new Date('2024-01-02') } },
      ]);

      const result = await service.listChats('tenant-1', 1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({ id: '5491100000002', messageCount: 2 });
    });

    it('merges counts and takes max lastMessageAt for same phone (req 1.2, 1.7)', async () => {
      const phone = '5491100000001';
      prismaMock.incomingMessage.groupBy.mockResolvedValue([
        { from: phone, _count: { id: 3 }, _max: { createdAt: new Date('2024-01-01') } },
      ]);
      prismaMock.message.groupBy.mockResolvedValue([
        { phone, _count: { id: 2 }, _max: { createdAt: new Date('2024-01-05') } },
      ]);

      const result = await service.listChats('tenant-1', 1, 20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].messageCount).toBe(5);
      expect(result.data[0].lastMessageAt).toEqual(new Date('2024-01-05'));
    });

    it('produces unique entries per phone number (req 1.1)', async () => {
      const phone = '5491100000001';
      prismaMock.incomingMessage.groupBy.mockResolvedValue([
        { from: phone, _count: { id: 1 }, _max: { createdAt: new Date('2024-01-01') } },
      ]);
      prismaMock.message.groupBy.mockResolvedValue([
        { phone, _count: { id: 1 }, _max: { createdAt: new Date('2024-01-02') } },
      ]);

      const result = await service.listChats('tenant-1', 1, 20);
      const ids = result.data.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(1);
    });

    it('sorts chats by lastMessageAt DESC (req 1.3)', async () => {
      prismaMock.incomingMessage.groupBy.mockResolvedValue([
        { from: 'phone-A', _count: { id: 1 }, _max: { createdAt: new Date('2024-01-01') } },
        { from: 'phone-B', _count: { id: 1 }, _max: { createdAt: new Date('2024-01-10') } },
        { from: 'phone-C', _count: { id: 1 }, _max: { createdAt: new Date('2024-01-05') } },
      ]);

      const result = await service.listChats('tenant-1', 1, 20);
      const dates = result.data.map((c) => c.lastMessageAt.getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });

    it('applies pagination correctly (req 3.1, 3.5, 3.6)', async () => {
      prismaMock.incomingMessage.groupBy.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          from: `phone-${i}`,
          _count: { id: 1 },
          _max: { createdAt: new Date(2024, 0, i + 1) },
        })),
      );

      const result = await service.listChats('tenant-1', 2, 2);
      expect(result.data).toHaveLength(2);
      expect(result.meta).toMatchObject({ total: 5, page: 2, limit: 2, totalPages: 3 });
    });

    it('returns empty page when page exceeds totalPages (req 3.1)', async () => {
      prismaMock.incomingMessage.groupBy.mockResolvedValue([
        { from: 'phone-1', _count: { id: 1 }, _max: { createdAt: new Date('2024-01-01') } },
      ]);

      const result = await service.listChats('tenant-1', 99, 20);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(1);
    });

    it('passes tenantId to both groupBy queries (req 3.5)', async () => {
      await service.listChats('my-tenant', 1, 20);
      expect(prismaMock.incomingMessage.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'my-tenant' } }),
      );
      expect(prismaMock.message.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'my-tenant' } }),
      );
    });
  });

  // ─── getChatMessages ──────────────────────────────────────────────────────

  describe('getChatMessages', () => {
    it('returns empty list when no messages exist (req 2.4)', async () => {
      const result = await service.getChatMessages('tenant-1', 'phone-1', 1, 20);
      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 20, totalPages: 0 });
    });

    it('maps IncomingMessage to direction=inbound (req 2.2)', async () => {
      prismaMock.incomingMessage.findMany.mockResolvedValue([
        { id: 'inc-1', type: 'text', text: 'hello', createdAt: new Date('2024-01-01') },
      ]);

      const result = await service.getChatMessages('tenant-1', 'phone-1', 1, 20);
      expect(result.data[0]).toMatchObject({ id: 'inc-1', direction: 'inbound', type: 'text', text: 'hello' });
      expect(result.data[0].status).toBeUndefined();
    });

    it('maps Message to direction=outbound with status (req 2.2)', async () => {
      prismaMock.message.findMany.mockResolvedValue([
        { id: 'msg-1', type: 'text', status: 'SENT', createdAt: new Date('2024-01-02') },
      ]);

      const result = await service.getChatMessages('tenant-1', 'phone-1', 1, 20);
      expect(result.data[0]).toMatchObject({ id: 'msg-1', direction: 'outbound', type: 'text', status: 'SENT' });
    });

    it('merges inbound and outbound messages (req 2.1)', async () => {
      prismaMock.incomingMessage.findMany.mockResolvedValue([
        { id: 'inc-1', type: 'text', text: 'hi', createdAt: new Date('2024-01-01') },
      ]);
      prismaMock.message.findMany.mockResolvedValue([
        { id: 'msg-1', type: 'text', status: 'SENT', createdAt: new Date('2024-01-02') },
      ]);

      const result = await service.getChatMessages('tenant-1', 'phone-1', 1, 20);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('sorts messages by createdAt ASC (req 2.3)', async () => {
      prismaMock.incomingMessage.findMany.mockResolvedValue([
        { id: 'inc-1', type: 'text', createdAt: new Date('2024-01-05') },
        { id: 'inc-2', type: 'text', createdAt: new Date('2024-01-01') },
      ]);
      prismaMock.message.findMany.mockResolvedValue([
        { id: 'msg-1', type: 'text', status: 'SENT', createdAt: new Date('2024-01-03') },
      ]);

      const result = await service.getChatMessages('tenant-1', 'phone-1', 1, 20);
      const dates = result.data.map((m) => m.createdAt.getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i + 1]);
      }
    });

    it('applies pagination correctly (req 3.2, 3.6)', async () => {
      prismaMock.incomingMessage.findMany.mockResolvedValue(
        Array.from({ length: 7 }, (_, i) => ({
          id: `inc-${i}`,
          type: 'text',
          createdAt: new Date(2024, 0, i + 1),
        })),
      );

      const result = await service.getChatMessages('tenant-1', 'phone-1', 2, 3);
      expect(result.data).toHaveLength(3);
      expect(result.meta).toMatchObject({ total: 7, page: 2, limit: 3, totalPages: 3 });
    });

    it('passes tenantId and phone to both findMany queries (req 2.7)', async () => {
      await service.getChatMessages('my-tenant', '5491100000001', 1, 20);
      expect(prismaMock.incomingMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'my-tenant', from: '5491100000001' } }),
      );
      expect(prismaMock.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'my-tenant', phone: '5491100000001' } }),
      );
    });

    it('inbound messages have no status field (req 2.2)', async () => {
      prismaMock.incomingMessage.findMany.mockResolvedValue([
        { id: 'inc-1', type: 'text', text: null, createdAt: new Date('2024-01-01') },
      ]);

      const result = await service.getChatMessages('tenant-1', 'phone-1', 1, 20);
      expect(result.data[0].status).toBeUndefined();
    });

    it('text is undefined when null in IncomingMessage (req 2.2)', async () => {
      prismaMock.incomingMessage.findMany.mockResolvedValue([
        { id: 'inc-1', type: 'image', text: null, createdAt: new Date('2024-01-01') },
      ]);

      const result = await service.getChatMessages('tenant-1', 'phone-1', 1, 20);
      expect(result.data[0].text).toBeUndefined();
    });
  });
});
