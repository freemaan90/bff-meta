import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

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

    // Registro de una cola específica
    BullModule.registerQueue({
      name: 'chatbot-events',
    }),
  ],
})
export class BullmqModule {}
