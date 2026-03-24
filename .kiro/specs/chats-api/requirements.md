# Documento de Requisitos

## Introducción

Esta feature expone dos endpoints REST en la aplicación NestJS multi-tenant para consultar conversaciones de WhatsApp:

- `GET /chats` — lista los chats únicos agrupados por número de teléfono del tenant autenticado.
- `GET /chats/:id/messages` — lista el historial de mensajes (entrantes y salientes) de un chat específico.

Un "chat" es una conversación identificada por un número de teléfono (`from` en `IncomingMessage` / `phone` en `Message`). La autenticación se realiza mediante API key (`x-api-key`), que determina el `tenantId`.

---

## Glosario

- **Chats_API**: El módulo NestJS que implementa los endpoints `GET /chats` y `GET /chats/:id/messages`.
- **Chat**: Agrupación lógica de mensajes entrantes y salientes asociados a un número de teléfono dentro de un tenant.
- **Chat_ID**: Identificador de un chat, equivalente al número de teléfono normalizado (e.g. `5491112345678`).
- **IncomingMessage**: Registro en base de datos de un mensaje recibido desde WhatsApp, con campos `id`, `tenantId`, `messageId`, `from`, `type`, `text`, `raw`, `createdAt`.
- **Message**: Registro en base de datos de un mensaje saliente enviado por el sistema, con campos `id`, `tenantId`, `phone`, `type`, `messageId`, `status`, `error`, `variables`, `createdAt`, `updatedAt`.
- **Tenant**: Organización identificada por `tenantId`, obtenida a partir del API key autenticado.
- **ApiKeyGuard**: Guard de NestJS que valida el header `x-api-key` e inyecta `tenantId` en el request.
- **PrismaService**: Servicio de acceso a base de datos PostgreSQL mediante Prisma ORM.

---

## Requisitos

### Requisito 1: Listar chats del tenant

**User Story:** Como desarrollador que consume la API, quiero obtener la lista de chats únicos de mi tenant, para poder mostrar las conversaciones activas en mi aplicación.

#### Criterios de Aceptación

1. WHEN el cliente envía `GET /chats` con un header `x-api-key` válido, THE Chats_API SHALL retornar una lista de chats únicos agrupados por número de teléfono del tenant correspondiente.
2. WHEN el cliente envía `GET /chats` con un header `x-api-key` válido, THE Chats_API SHALL incluir en cada chat: el `id` (número de teléfono), la fecha y hora del último mensaje (`lastMessageAt`), y el conteo total de mensajes (`messageCount`).
3. WHEN el cliente envía `GET /chats` con un header `x-api-key` válido, THE Chats_API SHALL ordenar los chats por `lastMessageAt` de forma descendente (más reciente primero).
4. WHEN el cliente envía `GET /chats` con un header `x-api-key` válido y no existen mensajes para el tenant, THE Chats_API SHALL retornar una lista vacía con código HTTP 200.
5. IF el cliente envía `GET /chats` sin el header `x-api-key`, THEN THE Chats_API SHALL retornar HTTP 401 con un mensaje de error indicando que falta la API key.
6. IF el cliente envía `GET /chats` con un header `x-api-key` inválido, THEN THE Chats_API SHALL retornar HTTP 401 con un mensaje de error indicando que la API key es inválida.
7. THE Chats_API SHALL considerar tanto los mensajes de `IncomingMessage` (campo `from`) como los de `Message` (campo `phone`) para construir la lista de chats únicos del tenant.

---

### Requisito 2: Listar mensajes de un chat

**User Story:** Como desarrollador que consume la API, quiero obtener el historial de mensajes de un chat específico, para poder mostrar la conversación completa con un número de teléfono.

#### Criterios de Aceptación

1. WHEN el cliente envía `GET /chats/:id/messages` con un header `x-api-key` válido, THE Chats_API SHALL retornar la lista de mensajes (entrantes y salientes) asociados al número de teléfono `:id` dentro del tenant autenticado.
2. WHEN el cliente envía `GET /chats/:id/messages` con un header `x-api-key` válido, THE Chats_API SHALL incluir en cada mensaje: `id`, `direction` (`inbound` o `outbound`), `type`, `text` (si aplica), `status` (para mensajes salientes), `createdAt`.
3. WHEN el cliente envía `GET /chats/:id/messages` con un header `x-api-key` válido, THE Chats_API SHALL ordenar los mensajes por `createdAt` de forma ascendente (más antiguo primero).
4. WHEN el cliente envía `GET /chats/:id/messages` con un header `x-api-key` válido y el chat no tiene mensajes, THE Chats_API SHALL retornar una lista vacía con código HTTP 200.
5. IF el cliente envía `GET /chats/:id/messages` sin el header `x-api-key`, THEN THE Chats_API SHALL retornar HTTP 401 con un mensaje de error indicando que falta la API key.
6. IF el cliente envía `GET /chats/:id/messages` con un header `x-api-key` inválido, THEN THE Chats_API SHALL retornar HTTP 401 con un mensaje de error indicando que la API key es inválida.
7. THE Chats_API SHALL garantizar que los mensajes retornados pertenezcan exclusivamente al tenant autenticado, sin exponer datos de otros tenants.

---

### Requisito 3: Paginación de resultados

**User Story:** Como desarrollador que consume la API, quiero poder paginar los resultados de chats y mensajes, para evitar cargar grandes volúmenes de datos en una sola respuesta.

#### Criterios de Aceptación

1. WHEN el cliente envía `GET /chats` con los parámetros opcionales `page` y `limit`, THE Chats_API SHALL retornar el subconjunto de chats correspondiente a la página solicitada.
2. WHEN el cliente envía `GET /chats/:id/messages` con los parámetros opcionales `page` y `limit`, THE Chats_API SHALL retornar el subconjunto de mensajes correspondiente a la página solicitada.
3. WHERE el parámetro `limit` es proporcionado, THE Chats_API SHALL aceptar valores entre 1 y 100 inclusive.
4. IF el cliente envía `limit` con un valor fuera del rango [1, 100], THEN THE Chats_API SHALL retornar HTTP 400 con un mensaje de error descriptivo.
5. WHEN el cliente no proporciona `page` ni `limit`, THE Chats_API SHALL aplicar valores por defecto de `page=1` y `limit=20`.
6. THE Chats_API SHALL incluir en la respuesta los metadatos de paginación: `total`, `page`, `limit` y `totalPages`.
