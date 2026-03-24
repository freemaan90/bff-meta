# Documento de Requisitos

## Introducción

Este documento describe los requisitos para agregar un WebSocket Gateway a la aplicación NestJS BFF-Meta. El gateway permitirá notificar a clientes frontend en tiempo real sobre eventos relevantes: mensajes entrantes de WhatsApp, cambios de estado de mensajes salientes y eventos de campaña. El gateway se integrará con los módulos existentes de webhooks, mensajes y campañas sin modificar su lógica de negocio.

## Glosario

- **WebSocket_Gateway**: Componente NestJS que gestiona conexiones WebSocket persistentes con clientes usando Socket.IO.
- **Cliente**: Aplicación frontend o consumidor que establece una conexión WebSocket con el gateway.
- **Tenant**: Organización o cuenta registrada en el sistema, identificada por un `tenantId`.
- **Sala (Room)**: Canal de Socket.IO al que se suscriben los clientes para recibir eventos de un tenant específico.
- **Evento_Entrante**: Notificación emitida cuando se recibe un mensaje de WhatsApp desde la API de Meta.
- **Evento_Estado**: Notificación emitida cuando cambia el estado de un mensaje saliente (SENT, DELIVERED, READ, FAILED).
- **WebhookService**: Servicio existente que procesa los webhooks de Meta y persiste mensajes entrantes.
- **MessagesService**: Servicio existente que gestiona el envío de mensajes salientes.

---

## Requisitos

### Requisito 1: Establecimiento de conexión WebSocket

**User Story:** Como cliente frontend, quiero conectarme al servidor mediante WebSocket, para recibir notificaciones en tiempo real sin necesidad de hacer polling.

#### Criterios de Aceptación

1. THE WebSocket_Gateway SHALL aceptar conexiones WebSocket en el namespace `/events` usando Socket.IO.
2. WHEN un cliente se conecta, THE WebSocket_Gateway SHALL registrar la conexión con el identificador de socket.
3. WHEN un cliente se desconecta, THE WebSocket_Gateway SHALL liberar los recursos asociados a esa conexión.
4. THE WebSocket_Gateway SHALL permitir conexiones desde cualquier origen (CORS configurado con `origin: "*"`).

---

### Requisito 2: Suscripción a eventos por tenant

**User Story:** Como cliente frontend, quiero suscribirme a los eventos de un tenant específico, para recibir solo las notificaciones relevantes a mi organización.

#### Criterios de Aceptación

1. WHEN un cliente emite el evento `subscribe` con un `tenantId` válido, THE WebSocket_Gateway SHALL unir al cliente a la sala correspondiente al `tenantId`.
2. WHEN un cliente emite el evento `unsubscribe` con un `tenantId`, THE WebSocket_Gateway SHALL remover al cliente de la sala correspondiente.
3. IF un cliente emite el evento `subscribe` sin un `tenantId`, THEN THE WebSocket_Gateway SHALL ignorar la solicitud sin emitir error al resto de clientes.
4. WHILE un cliente permanece en una sala, THE WebSocket_Gateway SHALL entregar todos los eventos emitidos a esa sala al cliente.

---

### Requisito 3: Notificación de mensajes entrantes de WhatsApp

**User Story:** Como cliente frontend, quiero recibir una notificación en tiempo real cuando llegue un mensaje de WhatsApp a un tenant, para poder actualizar la interfaz sin recargar la página.

#### Criterios de Aceptación

1. WHEN el WebhookService procesa un mensaje entrante de WhatsApp, THE WebSocket_Gateway SHALL emitir el evento `incoming_message` a la sala del `tenantId` correspondiente.
2. THE WebSocket_Gateway SHALL incluir en el payload del evento `incoming_message` los campos: `messageId`, `from`, `type`, `text` y `tenantId`.
3. IF el `tenantId` asociado al mensaje entrante no tiene clientes suscritos, THEN THE WebSocket_Gateway SHALL emitir el evento igualmente sin generar error.

---

### Requisito 4: Notificación de cambios de estado de mensajes salientes

**User Story:** Como cliente frontend, quiero recibir una notificación cuando cambie el estado de un mensaje saliente, para mostrar confirmaciones de entrega y lectura en tiempo real.

#### Criterios de Aceptación

1. WHEN el WebhookService procesa un cambio de estado de un mensaje, THE WebSocket_Gateway SHALL emitir el evento `message_status` a la sala del `tenantId` correspondiente.
2. THE WebSocket_Gateway SHALL incluir en el payload del evento `message_status` los campos: `messageId`, `status` y `tenantId`.
3. IF el estado recibido es `FAILED`, THEN THE WebSocket_Gateway SHALL incluir el campo `error` en el payload del evento `message_status`.

---

### Requisito 5: Integración no intrusiva con módulos existentes

**User Story:** Como desarrollador, quiero que el WebSocket Gateway se integre con los servicios existentes sin modificar su lógica de negocio, para mantener la cohesión y facilitar el mantenimiento.

#### Criterios de Aceptación

1. THE WebSocket_Gateway SHALL ser un proveedor inyectable de NestJS exportado desde su propio módulo `WebsocketModule`.
2. THE WebsocketModule SHALL poder ser importado por `WebhooksModule` y cualquier otro módulo que necesite emitir eventos en tiempo real.
3. THE WebSocket_Gateway SHALL exponer un método público `emitToTenant(tenantId: string, event: string, payload: object)` para que otros servicios puedan emitir eventos sin acoplarse a Socket.IO directamente.
4. WHEN `emitToTenant` es invocado antes de que el servidor Socket.IO esté inicializado, THE WebSocket_Gateway SHALL registrar una advertencia en el logger y no lanzar una excepción.
