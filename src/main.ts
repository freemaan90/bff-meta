import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Raw body middleware — must be registered before any other body parser
  // so that WebhookGuard can access req.rawBody as a Buffer
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  }));

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Gateway Port: ${process.env.PORT ?? 3000}`)

}
bootstrap();
