export class MetaApiError extends Error {
  code: number;
  type: string;
  fbtrace_id: string;

  constructor(params: {
    code: number;
    message: string;
    type: string;
    fbtrace_id: string;
  }) {
    super(params.message);
    this.name = 'MetaApiError';
    this.code = params.code;
    this.type = params.type;
    this.fbtrace_id = params.fbtrace_id;
  }
}

export class MessageSendException extends Error {
  cause?: MetaApiError;

  constructor(message: string, cause?: MetaApiError) {
    super(message);
    this.name = 'MessageSendException';
    this.cause = cause;
  }
}

export class ValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationException';
  }
}
