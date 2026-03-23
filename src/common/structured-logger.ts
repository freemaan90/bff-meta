import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface RequestLogContext {
  tenantId: string;
  phoneNumberId: string;
  messageType: string;
  requestId?: string;
}

export interface SuccessLogContext extends RequestLogContext {
  messageId: string;
}

export interface ErrorLogContext extends RequestLogContext {
  fbtrace_id: string;
  errorCode: number;
  errorType: string;
}

export interface WebhookEventContext {
  eventType: string;
  phoneNumberId: string;
  requestId?: string;
}

export interface SignatureFailureContext {
  sourceIp: string;
  requestId?: string;
}

export class StructuredLogger {
  private readonly logger: Logger;

  constructor(context?: string) {
    this.logger = new Logger(context ?? StructuredLogger.name);
  }

  private resolveRequestId(requestId?: string): string {
    return requestId ?? randomUUID();
  }

  logRequest(context: RequestLogContext): void {
    const entry = JSON.stringify({
      event: 'graph_api_request',
      tenantId: context.tenantId,
      phoneNumberId: context.phoneNumberId,
      messageType: context.messageType,
      timestamp: new Date().toISOString(),
      requestId: this.resolveRequestId(context.requestId),
    });
    this.logger.log(entry);
  }

  logSuccess(context: SuccessLogContext): void {
    const entry = JSON.stringify({
      event: 'graph_api_success',
      tenantId: context.tenantId,
      phoneNumberId: context.phoneNumberId,
      messageType: context.messageType,
      timestamp: new Date().toISOString(),
      requestId: this.resolveRequestId(context.requestId),
      messageId: context.messageId,
    });
    this.logger.log(entry);
  }

  logError(context: ErrorLogContext): void {
    const entry = JSON.stringify({
      event: 'graph_api_error',
      tenantId: context.tenantId,
      phoneNumberId: context.phoneNumberId,
      messageType: context.messageType,
      timestamp: new Date().toISOString(),
      requestId: this.resolveRequestId(context.requestId),
      fbtrace_id: context.fbtrace_id,
      errorCode: context.errorCode,
      errorType: context.errorType,
    });
    this.logger.error(entry);
  }

  logWebhookEvent(context: WebhookEventContext): void {
    const entry = JSON.stringify({
      event: 'webhook_event',
      eventType: context.eventType,
      phoneNumberId: context.phoneNumberId,
      timestamp: new Date().toISOString(),
      requestId: this.resolveRequestId(context.requestId),
    });
    this.logger.debug(entry);
  }

  logSignatureFailure(context: SignatureFailureContext): void {
    const entry = JSON.stringify({
      event: 'webhook_signature_failure',
      sourceIp: context.sourceIp,
      timestamp: new Date().toISOString(),
      requestId: this.resolveRequestId(context.requestId),
    });
    this.logger.warn(entry);
  }
}
