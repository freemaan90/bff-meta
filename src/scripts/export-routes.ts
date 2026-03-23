import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from 'src/app.module';

async function exportRoutes() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('API Docs')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  writeFileSync('routes.json', JSON.stringify(document.paths, null, 2));

  console.log('📄 Archivo routes.json generado con éxito');
  await app.close();
}

exportRoutes();
