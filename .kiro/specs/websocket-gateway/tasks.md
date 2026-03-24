# Plan de Implementación: WebSocket Gateway

## Overview

Implementación del módulo `WebsocketModule` con `EventsGateway` usando NestJS + Socket.IO, integrado de forma no intrusiva con `WebhookService` para emitir eventos en tiempo real a clientes frontend.

## Tasks

- [x] 1. Instalar dependencias y crear estructura del módulo
  - Instalar `@nestjs/websockets`, `@nestjs/platform-socket.io` y `socket.io`
  - Crear directorio `src/modules/websocket/`
  - Crear `src/modules/websocket/websocket.module.ts` con `WebsocketModule` que declara y exporta `EventsGateway`
  - _Requirements: 5.1, 5.2_

- [x] 2. Implementar EventsGateway
  - [x] 2.1 Crear `src/modules/websocket/events.gateway.ts`
    - Decorar con `@WebSocketGateway({ namespace: '/events', cors: { origin: '*' } })`
    - Implementar `OnGatewayInit`, `OnGatewayConnection`, `OnGatewayDisconnect`
    - Registrar conexión/desconexión con `Logger` de NestJS
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Implementar `handleSubscribe` y `handleUnsubscribe`
    - `@SubscribeMessage('subscribe')`: validar `tenantId` no vacío, llamar `client.join(tenantId)`
    - `@SubscribeMessage('unsubscribe')`: llamar `client.leave(tenantId)`
    - Si `tenantId` es vacío/nulo en subscribe, retornar sin acción ni error
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.3 Implementar `emitToTenant`
    - Verificar `this.server` antes de emitir; si no está inicializado, loguear advertencia y retornar
    - Llamar `this.server.to(tenantId).emit(event, payload)`
    - _Requirements: 5.3, 5.4_

  - [ ]* 2.4 Escribir unit tests para EventsGateway
    - Verificar decorador `@WebSocketGateway` con namespace `/events` y CORS `origin: '*'`
    - Verificar que `emitToTenant` no lanza excepción cuando `this.server` es `undefined`
    - Verificar que `handleSubscribe` ignora `tenantId` vacío o nulo
    - Verificar que `WebsocketModule` exporta `EventsGateway`
    - _Requirements: 1.1, 1.4, 2.3, 5.1, 5.4_

  - [ ]* 2.5 Escribir property test: Property 1 — Subscribe une al cliente a la sala del tenant
    - **Property 1: Subscribe une al cliente a la sala del tenant**
    - **Validates: Requirements 2.1**
    - Usar `fc.uuid()` para generar `tenantId` arbitrarios; verificar que `client.rooms` contiene el `tenantId` tras `handleSubscribe`

  - [ ]* 2.6 Escribir property test: Property 2 — Subscribe/Unsubscribe es un round-trip
    - **Property 2: Subscribe → Unsubscribe es un round-trip**
    - **Validates: Requirements 2.2**
    - Usar `fc.uuid()` para generar `tenantId` arbitrarios; verificar que `client.rooms` no contiene el `tenantId` tras subscribe + unsubscribe

- [x] 3. Checkpoint — Verificar módulo base
  - Asegurar que todos los tests pasan. Consultar al usuario si surgen dudas.

- [x] 4. Integrar EventsGateway con WebhookService
  - [x] 4.1 Modificar `WebhooksModule` para importar `WebsocketModule`
    - Añadir `WebsocketModule` al array `imports` de `WebhooksModule`
    - _Requirements: 5.2_

  - [x] 4.2 Inyectar `EventsGateway` en `WebhookService` y emitir `incoming_message`
    - Añadir `EventsGateway` al constructor de `WebhookService`
    - En `handleIncomingMessage`, tras el upsert, llamar `emitToTenant` con payload `{ messageId, from, type, text, tenantId }`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.3 Emitir `message_status` desde `handleStatus`
    - En `handleStatus`, consultar la BD por `messageId` para obtener el `tenantId` del mensaje
    - Llamar `emitToTenant` con payload `{ messageId, status, tenantId, ...(error ? { error } : {}) }`
    - Si el mensaje no existe en BD, omitir la emisión sin lanzar excepción
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 2.7 Escribir property test: Property 3 — Payload de `incoming_message` contiene todos los campos requeridos
    - **Property 3: Payload de incoming_message contiene todos los campos requeridos**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Usar `fc.record({ messageId: fc.uuid(), from: fc.string(), type: fc.string(), text: fc.option(fc.string()), tenantId: fc.uuid() })` para generar payloads arbitrarios; verificar que `emitToTenant` es llamado con todos los campos correctos

  - [ ]* 2.8 Escribir property test: Property 4 — Payload de `message_status` contiene todos los campos requeridos
    - **Property 4: Payload de message_status contiene todos los campos requeridos**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Usar `fc.record` con `status` de `['SENT', 'DELIVERED', 'READ', 'FAILED']`; verificar presencia de `error` cuando `status === 'FAILED'`

  - [ ]* 4.4 Escribir unit tests de integración para WebhookService con EventsGateway mockeado
    - Mockear `EventsGateway` y verificar que `emitToTenant` es llamado con los argumentos correctos al procesar webhooks entrantes y de estado
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3_

- [x] 5. Registrar WebsocketModule en AppModule
  - Añadir `WebsocketModule` al array `imports` de `AppModule` en `src/app.module.ts`
  - _Requirements: 5.1_

- [x] 6. Checkpoint final — Asegurar que todos los tests pasan
  - Asegurar que todos los tests pasan. Consultar al usuario si surgen dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los property tests usan `fast-check` (ya incluido en devDependencies)
- Los unit tests mockean el `Server` de Socket.IO para evitar levantar un servidor real
