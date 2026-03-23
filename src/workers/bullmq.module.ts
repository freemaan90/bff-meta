import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagesModule } from '../modules/messages/messages.module';
import { MetaModule } from '../integrations/meta/meta.module';
import { RetryMessageWorker } from './retry-message.worker';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Registro global de BullMQ con Redis
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST'),
          port: Number(config.get('REDIS_PORT')),
          password: config.get('REDIS_PASSWORD'),
        },
        prefix: 'whatsapp-meta', // opcional, útil para multi-tenant
      }),
      inject: [ConfigService],
    }),

    // Cola de chatbot
    BullModule.registerQueue({
      name: 'chatbot-events',
    }),

    // Cola de envío de mensajes con retry exponencial
    BullModule.registerQueue({
      name: 'send-message',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),

    MessagesModule,
    MetaModule,
  ],
  providers: [RetryMessageWorker],
})
export class BullmqModule {}
