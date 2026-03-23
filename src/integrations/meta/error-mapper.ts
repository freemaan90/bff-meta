import { MetaApiError } from './errors';

const RATE_LIMIT_CODE = 130429;
const WINDOW_EXPIRED_CODE = 131047;

export function mapGraphApiError(errorResponse: unknown): MetaApiError {
  const raw = errorResponse as Record<string, unknown>;
  const error = (raw?.error ?? {}) as Record<string, unknown>;

  const code = typeof error.code === 'number' ? error.code : 0;
  const message = typeof error.message === 'string' ? error.message : 'Unknown error';
  const fbtrace_id = typeof error.fbtrace_id === 'string' ? error.fbtrace_id : '';

  let type: string;
  if (code === RATE_LIMIT_CODE) {
    type = 'RATE_LIMIT';
  } else if (code === WINDOW_EXPIRED_CODE) {
    type = 'WINDOW_EXPIRED';
  } else {
    type = typeof error.type === 'string' && error.type ? error.type : 'UNKNOWN';
  }

  return new MetaApiError({ code, message, type, fbtrace_id });
}
