# Requirements Document

## Introduction

Este documento describe los requisitos para completar e integrar correctamente la Meta WhatsApp Business API (Graph API) en el proyecto NestJS existente. El proyecto ya cuenta con envío básico de templates y texto, webhook de verificación, campañas masivas con BullMQ, chatbot multi-modo y multi-tenancy con API Keys. Los gaps identificados incluyen: cliente Meta sin implementar, ausencia de verificación de firma del webhook, manejo de errores no estandarizado, falta de retry logic, sin soporte de media, sin gestión de templates vía API, sin rate limiting, sin validación E.164, módulo messages vacío, variables de entorno sin validación, versión de API hardcodeada y ausencia de logging estructurado.

## Glossary

- **Meta_Client**: Servicio centralizado (`MetaClient`) en `src/integrations/meta/meta.client.ts` responsable de todas las llamadas HTTP a la Graph API de Meta.
- **Graph_API**: API REST de Meta accesible en `https://graph.facebook.com/{version}/`.
- **Webhook_Guard**: Guard o middleware NestJS que verifica la firma `X-Hub-Signature-256` de los eventos entrantes de Meta.
- **Error_Mapper**: Función pura que transforma las respuestas de error de la Graph API en objetos `MetaApiError` tipados.
- **Retry_Worker**: Procesador BullMQ que reintenta el envío de mensajes fallidos con backoff exponencial.
- **Media_Service**: Servicio responsable de construir y enviar payloads de mensajes con contenido multimedia.
- **Template_Manager**: Servicio que gestiona templates de WhatsApp vía la Graph API (listar, crear, eliminar).
- **Rate_Limiter**: Mecanismo basado en Redis que controla la tasa de envío de mensajes hacia la Graph API por tenant.
- **Phone_Validator**: Utilidad que valida y normaliza números de teléfono al formato E.164.
- **Config_Service**: Servicio NestJS (`@nestjs/config` con `Joi`) que valida las variables de entorno al arrancar la aplicación.
- **Messages_Service**: Servicio del módulo `messages` que orquesta el envío de mensajes individuales (texto, template, media) y persiste el resultado en la base de datos.
- **Structured_Logger**: Logger NestJS configurado para emitir logs en formato JSON con campos de contexto (tenantId, messageId, fbtrace_id).
- **Tenant**: Entidad que representa a un cliente de la plataforma, con credenciales propias de WhatsApp (`accessToken`, `phoneNumberId`).
- **E.164**: Formato internacional de número de teléfono definido por la ITU-T (ej. `+5491112345678`).
- **WABA**: WhatsApp Business Account.
- **fbtrace_id**: Identificador de traza provisto por Meta en respuestas de error, útil para soporte.

---

## Requirements

### Requirement 1: Cliente Meta Centralizado

**User Story:** Como desarrollador, quiero un cliente HTTP centralizado para la Graph API, para que toda la lógica de comunicación con Meta esté en un único lugar y sea reutilizable por cualquier módulo.

#### Acceptance Criteria

1. THE Meta_Client SHALL exponer métodos tipados para cada operación de la Graph API: envío de mensajes (texto, template, media) y gestión de templates.
2. WHEN a request is made via Meta_Client, THE Meta_Client SHALL include the `Authorization: Bearer {accessToken}` header and the `Content-Type: application/json` header in every HTTP request.
3. THE Meta_Client SHALL construct the base URL using the configured API version from Config_Service, in the format `https://graph.facebook.com/{version}/{phoneNumberId}/messages`.
4. WHEN the Graph_API version changes in configuration, THE Meta_Client SHALL use the new version in all subsequent requests without requiring code changes.
5. THE Meta_Client SHALL be injectable as a NestJS provider and registered in a dedicated `MetaModule`.

---

### Requirement 2: Verificación de Firma del Webhook

**User Story:** Como operador de seguridad, quiero que el webhook verifique la firma `X-Hub-Signature-256` de cada evento entrante de Meta, para que solo se procesen eventos auténticos y se rechacen peticiones no autorizadas.

#### Acceptance Criteria

1. WHEN a POST request arrives at the webhook endpoint, THE Webhook_Guard SHALL extract the `X-Hub-Signature-256` header value.
2. WHEN the `X-Hub-Signature-256` header is present, THE Webhook_Guard SHALL compute `HMAC-SHA256(rawBody, APP_SECRET)` and compare it with the received signature using a timing-safe comparison.
3. IF the computed signature does not match the received signature, THEN THE Webhook_Guard SHALL reject the request with HTTP 403 and log a warning with the source IP.
4. IF the `X-Hub-Signature-256` header is absent, THEN THE Webhook_Guard SHALL reject the request with HTTP 401.
5. THE Webhook_Guard SHALL access the raw request body (Buffer) before any JSON parsing, to ensure the HMAC is computed over the original bytes.
6. FOR ALL valid webhook payloads signed with the correct APP_SECRET, THE Webhook_Guard SHALL allow the request to proceed to the handler (round-trip property: sign → verify = pass).

---

### Requirement 3: Manejo de Errores Estandarizado de la Graph API

**User Story:** Como desarrollador, quiero que los errores de la Graph API se mapeen a un tipo de error unificado, para que el resto de la aplicación pueda manejarlos de forma consistente sin parsear respuestas crudas.

#### Acceptance Criteria

1. THE Error_Mapper SHALL transform every Graph API error response into a `MetaApiError` object containing: `code` (number), `message` (string), `type` (string), and `fbtrace_id` (string).
2. WHEN the Graph_API returns an error with HTTP status 4xx or 5xx, THE Meta_Client SHALL invoke the Error_Mapper and throw a `MetaApiError` instead of a generic Error.
3. WHEN a `MetaApiError` is thrown, THE Messages_Service SHALL catch it, log the `fbtrace_id` and `code`, and rethrow a domain-level exception (`MessageSendException`) with a human-readable message.
4. IF the Graph_API returns error code 131047 (re-engagement window expired), THEN THE Error_Mapper SHALL set the `MetaApiError.type` to `'WINDOW_EXPIRED'`.
5. IF the Graph_API returns error code 130429 (rate limit hit), THEN THE Error_Mapper SHALL set the `MetaApiError.type` to `'RATE_LIMIT'`.

---

### Requirement 4: Retry Logic para Mensajes Fallidos

**User Story:** Como operador de campañas, quiero que los mensajes que fallen por errores transitorios se reintenten automáticamente, para que las campañas masivas no pierdan mensajes por fallas temporales de red o de la API.

#### Acceptance Criteria

1. WHEN a message send attempt fails with a recoverable error (network timeout, HTTP 5xx, or `MetaApiError.type === 'RATE_LIMIT'`), THE Retry_Worker SHALL re-enqueue the message job in BullMQ with exponential backoff starting at 5 seconds.
2. THE Retry_Worker SHALL attempt a maximum of 3 retries per message before marking the message as `FAILED` in the database.
3. WHEN a message is retried, THE Retry_Worker SHALL preserve the original `tenantId`, `campaignId`, `phone`, and `variables` from the original job.
4. IF a message fails with a non-recoverable error (HTTP 4xx excluding 429, or `MetaApiError.type === 'WINDOW_EXPIRED'`), THEN THE Retry_Worker SHALL mark the message as `FAILED` immediately without retrying.
5. WHEN a message is successfully sent after one or more retries, THE Retry_Worker SHALL update the message `status` to `SENT` and increment the campaign `sentCount`.
6. THE Retry_Worker SHALL be idempotent: retrying a message that was already successfully sent SHALL NOT create a duplicate message in WhatsApp or in the database.

---

### Requirement 5: Soporte de Mensajes con Media

**User Story:** Como usuario de la plataforma, quiero enviar mensajes con imágenes, documentos, audio y video a través de WhatsApp, para que las comunicaciones con los clientes sean más ricas y efectivas.

#### Acceptance Criteria

1. THE Media_Service SHALL support sending messages of type `image`, `document`, `audio`, and `video` via the Graph API.
2. WHEN sending a media message, THE Media_Service SHALL construct a payload with the `type` field set to the media type and a nested object (`image`, `document`, `audio`, or `video`) containing the `link` (URL) field.
3. WHEN sending a `document` type message, THE Media_Service SHALL include an optional `filename` field in the document object.
4. WHEN sending an `image` type message, THE Media_Service SHALL include an optional `caption` field in the image object.
5. IF the provided media URL is not a valid HTTPS URL, THEN THE Media_Service SHALL throw a `ValidationException` before making any API call.
6. WHEN a media message is sent successfully, THE Messages_Service SHALL persist the message in the database with `type` set to the corresponding media type and `status` set to `SENT`.

---

### Requirement 6: Gestión de Templates vía API

**User Story:** Como administrador de tenant, quiero listar, crear y eliminar templates de WhatsApp desde la plataforma, para que no tenga que acceder directamente al Meta Business Manager para gestionar las plantillas.

#### Acceptance Criteria

1. WHEN a GET request is made to the templates endpoint with a valid tenant API Key, THE Template_Manager SHALL retrieve and return the list of templates from the WABA associated with the tenant.
2. WHEN a POST request is made to the templates endpoint with a valid template definition, THE Template_Manager SHALL create the template in the tenant's WABA via the Graph API and return the created template's `id` and `status`.
3. WHEN a DELETE request is made to the templates endpoint with a valid template name, THE Template_Manager SHALL delete the template from the tenant's WABA via the Graph API.
4. IF the Graph_API returns an error during template creation, THEN THE Template_Manager SHALL return the `MetaApiError` details to the caller with HTTP 422.
5. THE Template_Manager SHALL use the tenant's `wabaId` (stored in the Tenant model) to construct the Graph API URL for template operations: `/{version}/{wabaId}/message_templates`.

---

### Requirement 7: Rate Limiting hacia la Graph API

**User Story:** Como operador de campañas, quiero que el sistema respete los límites de tasa de Meta, para que las campañas masivas no provoquen bloqueos de la cuenta de WhatsApp Business.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a maximum of 80 messages per second per tenant toward the Graph API, using a sliding window counter stored in Redis.
2. WHEN the Rate_Limiter detects that the per-tenant limit has been reached, THE Rate_Limiter SHALL delay the next message send until the window allows it, without dropping the message.
3. WHEN a `MetaApiError.type === 'RATE_LIMIT'` is received from the Graph API, THE Rate_Limiter SHALL pause all outgoing messages for that tenant for 60 seconds before resuming.
4. THE Rate_Limiter SHALL be applied at the Retry_Worker level, before each message send attempt.
5. FOR ALL campaign executions, the total messages sent per second per tenant SHALL NOT exceed the configured limit, regardless of the number of concurrent BullMQ workers (metamorphic property).

---

### Requirement 8: Validación de Formato E.164

**User Story:** Como desarrollador, quiero que todos los números de teléfono sean validados y normalizados al formato E.164 antes de enviar cualquier mensaje, para que no se produzcan errores de entrega por números mal formateados.

#### Acceptance Criteria

1. THE Phone_Validator SHALL accept a phone number string and return `true` if it conforms to E.164 format (starts with `+`, followed by 7 to 15 digits).
2. WHEN a phone number is provided without the `+` prefix but with a valid country code and digit count, THE Phone_Validator SHALL normalize it by prepending `+`.
3. IF a phone number cannot be normalized to a valid E.164 format, THEN THE Phone_Validator SHALL throw a `ValidationException` with the message `'Invalid phone number format'`.
4. THE Messages_Service SHALL invoke the Phone_Validator on every outgoing message before calling the Meta_Client.
5. THE Campaigns_Service SHALL invoke the Phone_Validator on each contact's phone number during campaign creation, and reject the entire campaign with HTTP 422 if any number is invalid.
6. FOR ALL valid E.164 numbers, normalizing then validating SHALL return `true` (round-trip property).

---

### Requirement 9: Módulo Messages Completo

**User Story:** Como desarrollador, quiero un módulo `messages` funcional que exponga endpoints REST para enviar mensajes individuales (texto, template, media), para que los tenants puedan enviar mensajes puntuales sin necesidad de crear una campaña.

#### Acceptance Criteria

1. THE Messages_Service SHALL expose a `sendText(tenantId, phone, text)` method that sends a plain text message via Meta_Client and persists the result in the `Message` table.
2. THE Messages_Service SHALL expose a `sendTemplate(tenantId, phone, template, language, variables)` method that sends a template message via Meta_Client and persists the result.
3. THE Messages_Service SHALL expose a `sendMedia(tenantId, phone, mediaType, mediaUrl, caption?, filename?)` method that sends a media message via Media_Service and persists the result.
4. WHEN a message is sent successfully, THE Messages_Service SHALL update the persisted `Message` record with the `messageId` returned by the Graph API and set `status` to `SENT`.
5. WHEN a message send fails, THE Messages_Service SHALL set the `Message` status to `FAILED` and store the error description in the `error` field.
6. THE Messages_Controller SHALL protect all endpoints with the existing `ApiKeyGuard` and validate request bodies using class-validator DTOs.

---

### Requirement 10: Validación de Variables de Entorno al Arrancar

**User Story:** Como operador de infraestructura, quiero que la aplicación valide todas las variables de entorno requeridas al iniciar, para que los errores de configuración se detecten en el arranque y no en tiempo de ejecución.

#### Acceptance Criteria

1. THE Config_Service SHALL define a Joi validation schema that marks the following variables as required: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`, `META_API_VERSION`.
2. IF any required environment variable is absent or empty at application startup, THEN THE Config_Service SHALL throw a descriptive error listing the missing variables and prevent the application from starting.
3. THE Config_Service SHALL validate that `REDIS_PORT` is a number between 1 and 65535.
4. THE Config_Service SHALL validate that `META_API_VERSION` matches the pattern `v\d+\.\d+` (e.g., `v20.0`).
5. WHERE `NODE_ENV` is set to `production`, THE Config_Service SHALL additionally require `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` to be present as fallback globals.

---

### Requirement 11: Versión de API Configurable

**User Story:** Como desarrollador, quiero que la versión de la Graph API sea configurable mediante una variable de entorno, para que las actualizaciones de versión no requieran cambios en el código fuente.

#### Acceptance Criteria

1. THE Meta_Client SHALL read the Graph API version exclusively from the `META_API_VERSION` environment variable via Config_Service.
2. WHEN `META_API_VERSION` is set to a new value (e.g., `v21.0`), THE Meta_Client SHALL use that version in all Graph API URLs without any code modification.
3. THE Meta_Client SHALL default to `v20.0` if `META_API_VERSION` is not set and the environment is not `production`.
4. FOR ALL requests made by Meta_Client, the URL SHALL contain the version string from Config_Service (invariant property).

---

### Requirement 12: Logging Estructurado y Observabilidad

**User Story:** Como operador de la plataforma, quiero que todas las interacciones con la Graph API generen logs estructurados en JSON, para que pueda monitorear el sistema, diagnosticar errores y auditar el tráfico por tenant.

#### Acceptance Criteria

1. THE Structured_Logger SHALL emit a log entry in JSON format for every outgoing request to the Graph API, including: `tenantId`, `phoneNumberId`, `messageType`, `timestamp`, and `requestId`.
2. WHEN a Graph API request succeeds, THE Structured_Logger SHALL emit a log entry at `INFO` level including the `messageId` returned by Meta.
3. WHEN a Graph API request fails, THE Structured_Logger SHALL emit a log entry at `ERROR` level including: `fbtrace_id`, `errorCode`, `errorType`, and `tenantId`.
4. WHEN a webhook event is received, THE Structured_Logger SHALL emit a log entry at `DEBUG` level including the event type and the source `phoneNumberId`.
5. WHEN a webhook signature verification fails, THE Structured_Logger SHALL emit a log entry at `WARN` level including the source IP address.
6. THE Structured_Logger SHALL use NestJS's built-in `Logger` class configured with JSON output, and SHALL NOT log sensitive data such as `accessToken` or message body content in production.
