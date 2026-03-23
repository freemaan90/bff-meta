# Implementation Plan: Meta API Integration

## Overview

Implementación incremental de la integración con la Meta WhatsApp Business API en el proyecto NestJS existente. Cada tarea construye sobre la anterior, comenzando por la infraestructura base (configuración, errores, cliente HTTP) y terminando con el cableado completo de todos los módulos.

## Tasks

- [x] 1. Instalar dependencias y configurar validación de entorno
  - Instalar `fast-check` como devDependency: `npm install --save-dev fast-check`
  - Instalar `joi` como dependency: `npm install joi`
  - Crear `src/config/config.validation.ts` con el schema Joi que valide: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT` (1-65535), `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, `META_API_VERSION` (patrón `v\d+\.\d+`), y en producción `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`
  - Actualizar `src/app.module.ts` para pasar `validationSchema` al `ConfigModule.forRoot`
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 1.1 Write property test for config validation — missing required variables
    - **Property 20: Config validation — missing required variables**
    - **Validates: Requirements 10.2**

  - [ ]* 1.2 Write property test for config validation — REDIS_PORT range
    - **Property 21: Config validation — REDIS_PORT range**
    - **Validates: Requirements 10.3**

  - [ ]* 1.3 Write property test for config validation — META_API_VERSION format
    - **Property 22: Config validation — META_API_VERSION format**
    - **Validates: Requirements 10.4**

- [x] 2. Implementar jerarquía de errores y ErrorMapper
  - Crear `src/integrations/meta/errors.ts` con las clases `MetaApiError` (code, message, type, fbtrace_id), `MessageSendException` y `ValidationException`
  - Crear `src/integrations/meta/error-mapper.ts` con la función pura `mapGraphApiError(errorResponse: unknown): MetaApiError`
    - code 130429 → type `'RATE_LIMIT'`
    - code 131047 → type `'WINDOW_EXPIRED'`
    - otros → type del campo `error.type` o `'UNKNOWN'`
  - _Requirements: 3.1, 3.4, 3.5_

  - [ ]* 2.1 Write property test for ErrorMapper output shape
    - **Property 5: ErrorMapper output shape**
    - **Validates: Requirements 3.1, 3.4, 3.5**

- [x] 3. Implementar PhoneValidator
  - Crear `src/common/phone-validator.ts` con la clase `PhoneValidator`:
    - `static validate(phone: string): boolean` — regex E.164 `/^\+[1-9]\d{6,14}$/`
    - `static normalize(phone: string): string` — antepone `+` si falta
    - `static validateOrThrow(phone: string): string` — normalize + validate, lanza `ValidationException('Invalid phone number format')` si inválido
  - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 3.1 Write property test for Phone E.164 round-trip
    - **Property 16: Phone E.164 round-trip**
    - **Validates: Requirements 8.6**

  - [ ]* 3.2 Write property test for invalid phone throws
    - **Property 17: Invalid phone throws**
    - **Validates: Requirements 8.3**

- [x] 4. Implementar MetaClient
  - Reemplazar el contenido de `src/integrations/meta/meta.client.ts` con la implementación completa del `MetaClient` injectable:
    - `private buildUrl(phoneNumberId: string): string` — usa `META_API_VERSION` de `ConfigService`
    - `async sendText(params: MetaSendTextParams): Promise<MetaSendResult>`
    - `async sendTemplate(params: MetaSendTemplateParams): Promise<MetaSendResult>`
    - `async sendMedia(params: MetaSendMediaParams): Promise<MetaSendResult>`
    - `async listTemplates(wabaId, accessToken): Promise<MetaTemplate[]>`
    - `async createTemplate(wabaId, accessToken, template): Promise<MetaTemplateResult>`
    - `async deleteTemplate(wabaId, accessToken, name): Promise<void>`
  - Todos los métodos deben incluir headers `Authorization: Bearer {accessToken}` y `Content-Type: application/json`
  - En caso de error HTTP, invocar `mapGraphApiError` y lanzar `MetaApiError`
  - Emitir logs estructurados (tenantId, phoneNumberId, messageType, timestamp, requestId) en cada request
  - Crear `src/integrations/meta/meta.module.ts` que provea y exporte `MetaClient`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.2, 11.3, 12.1, 12.2, 12.3_

  - [ ]* 4.1 Write property test for MetaClient headers invariant
    - **Property 1: MetaClient headers invariant**
    - **Validates: Requirements 1.2**

  - [ ]* 4.2 Write property test for MetaClient URL version invariant
    - **Property 2: MetaClient URL version invariant**
    - **Validates: Requirements 1.3, 11.4**

- [x] 5. Checkpoint — Asegurar que todos los tests pasen
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar WebhookGuard con verificación de firma
  - Crear `src/modules/webhooks/webhook.guard.ts` con `WebhookGuard implements CanActivate`:
    - Extraer `X-Hub-Signature-256` del header; si ausente → `UnauthorizedException` (401) + log WARN con IP
    - Computar `HMAC-SHA256(req.rawBody, META_APP_SECRET)` con `timingSafeEqual`
    - Si firma no coincide → `ForbiddenException` (403) + log WARN con IP
    - Si firma válida → retornar `true`
  - Actualizar `src/main.ts` para configurar `express.json({ verify: (req, res, buf) => { req.rawBody = buf; } })`
  - Aplicar `WebhookGuard` al endpoint POST de `WebhooksController`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.4, 12.5_

  - [x]* 6.1 Write property test for webhook signature round-trip
    - **Property 3: Webhook signature round-trip**
    - **Validates: Requirements 2.6**

  - [x]* 6.2 Write property test for webhook invalid signature rejection
    - **Property 4: Webhook invalid signature rejection**
    - **Validates: Requirements 2.3**

- [x] 7. Implementar MediaService
  - Crear `src/modules/messages/media.service.ts` con `MediaService`:
    - `buildPayload(mediaType, mediaUrl, caption?, filename?)` — construye el objeto payload con `type` y objeto anidado con `link`
    - Incluir `caption` para `image` y `filename` para `document`
    - Si `mediaUrl` no comienza con `https://` → lanzar `ValidationException` antes de cualquier llamada HTTP
    - `async send(params)` — delega a `MetaClient.sendMedia`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 7.1 Write property test for media payload structure
    - **Property 11: Media payload structure**
    - **Validates: Requirements 5.2**

  - [ ]* 7.2 Write property test for media URL validation
    - **Property 12: Media URL validation**
    - **Validates: Requirements 5.5**

- [x] 8. Implementar RateLimiter
  - Crear `src/integrations/meta/rate-limiter.ts` con `RateLimiter` injectable:
    - `async acquire(tenantId: string): Promise<void>` — sliding window en Redis, key `rate:${tenantId}`, ventana 1s, máx 80 msg/s; si límite alcanzado, esperar hasta que la ventana lo permita
    - `async pauseTenant(tenantId: string, durationMs: number): Promise<void>` — setea key `pause:${tenantId}` en Redis con TTL
    - `async isTenantPaused(tenantId: string): Promise<boolean>` — verifica existencia de key `pause:${tenantId}`
  - Registrar `ioredis` o usar el cliente Redis de BullMQ para las operaciones
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.1 Write property test for rate limit invariant (metamorphic)
    - **Property 14: Rate limit invariant (metamorphic)**
    - **Validates: Requirements 7.1, 7.5**

  - [ ]* 8.2 Write property test for rate limit pause on RATE_LIMIT error
    - **Property 15: Rate limit pause on RATE_LIMIT error**
    - **Validates: Requirements 7.3**

- [x] 9. Implementar MessagesService completo y MessagesController
  - Reemplazar `src/modules/messages/messages.service.ts` con la implementación completa:
    - `async sendText(tenantId, phone, text)` — valida E.164, crea `Message` (QUEUED), llama `MetaClient.sendText`, actualiza a SENT/FAILED
    - `async sendTemplate(tenantId, phone, template, language, variables?)` — mismo flujo con `MetaClient.sendTemplate`
    - `async sendMedia(tenantId, phone, mediaType, mediaUrl, caption?, filename?)` — mismo flujo con `MediaService`
    - Capturar `MetaApiError`, loguear `fbtrace_id` y `code`, relanzar como `MessageSendException`
  - Crear DTOs en `src/modules/messages/dto/`: `send-text.dto.ts`, `send-template.dto.ts`, `send-media.dto.ts` con validaciones class-validator
  - Actualizar `src/modules/messages/messages.controller.ts` con endpoints POST `/messages/text`, `/messages/template`, `/messages/media`, protegidos con `ApiKeyGuard`
  - Actualizar `src/modules/messages/messages.module.ts` para importar `MetaModule`, `PrismaModule`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 3.3, 8.4_

  - [ ]* 9.1 Write property test for error propagation to MessageSendException
    - **Property 6: Error propagation to MessageSendException**
    - **Validates: Requirements 3.3**

  - [ ]* 9.2 Write property test for message send and persist round-trip
    - **Property 18: Message send and persist round-trip**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [ ]* 9.3 Write property test for message failure persistence
    - **Property 19: Message failure persistence**
    - **Validates: Requirements 9.5**

- [x] 10. Checkpoint — Asegurar que todos los tests pasen
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implementar TemplateManager y TemplatesController
  - Crear `src/modules/templates/template-manager.service.ts` con `TemplateManager`:
    - `async list(tenantId): Promise<MetaTemplate[]>` — obtiene `wabaId` del tenant, llama `MetaClient.listTemplates`
    - `async create(tenantId, dto): Promise<MetaTemplateResult>` — llama `MetaClient.createTemplate`, retorna `{ id, status }`
    - `async delete(tenantId, name): Promise<void>` — llama `MetaClient.deleteTemplate`
    - En error de Graph API → retornar `MetaApiError` con HTTP 422
  - Crear `src/modules/templates/templates.controller.ts` con endpoints GET/POST/DELETE `/templates`, protegidos con `ApiKeyGuard`
  - Crear `src/modules/templates/templates.module.ts` importando `MetaModule`, `PrismaModule`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 11.1 Write property test for template create round-trip
    - **Property 13: Template create round-trip**
    - **Validates: Requirements 6.2, 6.5**

- [x] 12. Implementar RetryWorker con BullMQ
  - Crear `src/workers/retry-message.worker.ts` con `@Processor('send-message') RetryMessageWorker`:
    - Verificar idempotencia: si `Message.status === 'SENT'` → retornar sin enviar
    - Aplicar `RateLimiter.acquire(tenantId)` antes de cada intento
    - Llamar `MessagesService` según tipo de mensaje (text/template/media)
    - Errores recuperables (timeout, HTTP 5xx, `RATE_LIMIT`): relanzar para que BullMQ reintente; si `RATE_LIMIT` → llamar `RateLimiter.pauseTenant(tenantId, 60000)`
    - Errores no recuperables (HTTP 4xx excepto 429, `WINDOW_EXPIRED`): marcar `FAILED` en DB, NO relanzar
    - En éxito: actualizar `Message.status = SENT`, incrementar `campaign.sentCount`
  - Registrar la cola `send-message` en `BullmqModule` con `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`
  - Registrar `RetryMessageWorker` en el módulo correspondiente
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.4_

  - [ ]* 12.1 Write property test for retry classification invariant
    - **Property 7: Retry classification invariant**
    - **Validates: Requirements 4.1, 4.4**

  - [ ]* 12.2 Write property test for max retry count invariant
    - **Property 8: Max retry count invariant**
    - **Validates: Requirements 4.2**

  - [ ]* 12.3 Write property test for retry job data preservation
    - **Property 9: Retry job data preservation**
    - **Validates: Requirements 4.3**

  - [ ]* 12.4 Write property test for retry idempotence
    - **Property 10: Retry idempotence**
    - **Validates: Requirements 4.6**

- [x] 13. Migración Prisma: agregar campos wabaId y Message.type
  - Agregar campo `wabaId String?` al modelo `Tenant` en `prisma/schema.prisma`
  - Agregar campo `type String @default("text")` al modelo `Message` en `prisma/schema.prisma`
  - Ejecutar `npx prisma migrate dev --name add_waba_id_and_message_type`
  - _Requirements: 6.5, 5.6, 9.3_

- [x] 14. Implementar StructuredLogger y logging en MetaClient
  - Crear `src/common/structured-logger.ts` con un wrapper sobre el `Logger` de NestJS que emita JSON con los campos: `tenantId`, `phoneNumberId`, `messageType`, `timestamp`, `requestId`
  - Actualizar `MetaClient` para usar `StructuredLogger`:
    - Request saliente → INFO con campos requeridos (sin `accessToken` ni body)
    - Éxito → INFO con `messageId`
    - Error → ERROR con `fbtrace_id`, `errorCode`, `errorType`, `tenantId`
  - Actualizar `WebhooksController`/`WebhooksService` para loguear eventos entrantes en DEBUG y fallos de firma en WARN con IP
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 14.1 Write property test for structured logger output shape
    - **Property 23: Structured logger output shape**
    - **Validates: Requirements 12.1**

- [x] 15. Cablear módulos en AppModule y migrar WhatsappCoreService
  - Actualizar `src/app.module.ts` para importar `MetaModule`, `TemplatesModule` y el módulo del `RetryMessageWorker`
  - Actualizar `WhatsappCoreService` para delegar a `MetaClient` en lugar de usar axios directamente, eliminando la URL hardcodeada `v20.0`
  - Actualizar `CampaignsService` para invocar `PhoneValidator.validateOrThrow` en cada contacto durante la creación de campaña, rechazando con HTTP 422 si algún número es inválido
  - Verificar que `BullmqModule` registre la cola `send-message` con las opciones de retry correctas
  - _Requirements: 1.5, 8.5, 11.1, 11.2_

- [x] 16. Checkpoint final — Asegurar que todos los tests pasen
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los property tests usan `fast-check` con mínimo 100 iteraciones (`numRuns: 100`)
- Cada property test debe incluir el comentario: `// Feature: meta-api-integration, Property N: <texto>`
- La migración Prisma (tarea 13) puede ejecutarse en cualquier momento antes de la tarea 9
