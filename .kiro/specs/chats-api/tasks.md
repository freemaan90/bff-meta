# Plan de Implementación: Chats API

## Overview

Implementar el módulo `ChatsModule` en NestJS con dos endpoints REST (`GET /chats` y `GET /chats/:id/messages`) que consultan y fusionan datos de `IncomingMessage` y `Message` para exponer conversaciones paginadas por tenant.

## Tasks

- [x] 1. Crear DTOs y estructura del módulo
  - Crear directorio `src/modules/chats/` con los archivos base del módulo
  - Implementar `PaginationQueryDto` con validaciones `@IsInt`, `@Min`, `@Max`, `@IsOptional` y `@Type(() => Number)`
  - Implementar `ChatItemDto` y `ChatListResponseDto`
  - Implementar `MessageItemDto` y `MessageListResponseDto`
  - _Requirements: 1.2, 2.2, 3.3, 3.5, 3.6_

- [x] 2. Implementar ChatsService — lógica de listChats
  - [x] 2.1 Implementar método `listChats(tenantId, page, limit)`
    - Consultar `IncomingMessage` agrupado por `from` (count + max createdAt) para el tenant
    - Consultar `Message` agrupado por `phone` (count + max createdAt) para el tenant
    - Fusionar ambos mapas por teléfono: sumar `messageCount`, tomar `max(lastMessageAt)`
    - Ordenar por `lastMessageAt` DESC y aplicar paginación en memoria
    - Retornar `ChatListResponseDto` con metadatos (`total`, `page`, `limit`, `totalPages`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 3.1, 3.5, 3.6_

  - [ ]* 2.2 Escribir property test para unicidad de chats (Property 1)
    - **Property 1: Unicidad de chats por número de teléfono**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Escribir property test para correctitud de messageCount y lastMessageAt (Property 2)
    - **Property 2: Correctitud de messageCount y lastMessageAt**
    - **Validates: Requirements 1.2, 1.7**

  - [ ]* 2.4 Escribir property test para orden descendente de chats (Property 3)
    - **Property 3: Orden descendente de chats por lastMessageAt**
    - **Validates: Requirements 1.3**

- [x] 3. Implementar ChatsService — lógica de getChatMessages
  - [x] 3.1 Implementar método `getChatMessages(tenantId, phone, page, limit)`
    - Consultar todos los `IncomingMessage` donde `tenantId = X AND from = phone`
    - Consultar todos los `Message` donde `tenantId = X AND phone = phone`
    - Mapear a `MessageItemDto` con `direction: 'inbound'` o `'outbound'`
    - Fusionar, ordenar por `createdAt` ASC y aplicar paginación en memoria
    - Retornar `MessageListResponseDto` con metadatos
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 3.2, 3.5, 3.6_

  - [ ]* 3.2 Escribir property test para completitud e isolación por tenant+phone (Property 4)
    - **Property 4: Completitud e isolación de mensajes por tenant y teléfono**
    - **Validates: Requirements 2.1, 2.7**

  - [ ]* 3.3 Escribir property test para estructura de MessageItemDto (Property 5)
    - **Property 5: Estructura correcta de MessageItemDto con direction**
    - **Validates: Requirements 2.2**

  - [ ]* 3.4 Escribir property test para orden ascendente de mensajes (Property 6)
    - **Property 6: Orden ascendente de mensajes por createdAt**
    - **Validates: Requirements 2.3**

  - [ ]* 3.5 Escribir property test para aislamiento multi-tenant (Property 7)
    - **Property 7: Aislamiento multi-tenant**
    - **Validates: Requirements 2.7**

- [x] 4. Checkpoint — Verificar lógica del servicio
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementar ChatsController y registrar el módulo
  - [x] 5.1 Implementar `ChatsController` con `@UseGuards(ApiKeyGuard)`
    - Endpoint `GET /chats` → llama `listChats` con `req.tenantId` y `PaginationQueryDto`
    - Endpoint `GET /chats/:id/messages` → llama `getChatMessages` con `req.tenantId`, `phone` y `PaginationQueryDto`
    - _Requirements: 1.1, 1.5, 1.6, 2.1, 2.5, 2.6_

  - [x] 5.2 Crear `ChatsModule` e importar `PrismaModule`
    - Declarar `ChatsController` y `ChatsService` en el módulo
    - Importar `ChatsModule` en `AppModule`
    - _Requirements: 1.1, 2.1_

  - [ ]* 5.3 Escribir unit tests para ChatsController
    - Verificar 401 sin API key y con API key inválida (req 1.5, 1.6, 2.5, 2.6)
    - Verificar 400 con `limit=0`, `limit=101`, `page=0` (req 3.3, 3.4)
    - Verificar 200 con lista vacía cuando no hay mensajes (req 1.4, 2.4)
    - Verificar valores por defecto `page=1, limit=20` (req 3.5)
    - _Requirements: 1.4, 1.5, 1.6, 2.4, 2.5, 2.6, 3.3, 3.4, 3.5_

- [ ] 6. Implementar property tests de paginación y metadatos
  - [ ]* 6.1 Escribir property test para corrección de paginación (Property 8)
    - **Property 8: Corrección de paginación**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 6.2 Escribir property test para validación del parámetro limit (Property 9)
    - **Property 9: Validación del parámetro limit**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 6.3 Escribir property test para consistencia de metadatos (Property 10)
    - **Property 10: Consistencia matemática de metadatos de paginación**
    - **Validates: Requirements 3.6**

- [x] 7. Checkpoint final — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Los property tests usan `fast-check` (`npm install --save-dev fast-check`)
- El `tenantId` se obtiene de `req.tenantId` inyectado por el `ApiKeyGuard` existente
- La paginación de mensajes se realiza en memoria; para volúmenes grandes considerar migrar a vista SQL
- Cada tarea referencia los requisitos específicos para trazabilidad
