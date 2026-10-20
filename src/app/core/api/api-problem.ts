import { HttpErrorResponse } from '@angular/common/http';

/** Normalized view of the Agent A error envelope `{ error: { code, message, requestId, details? } }`. */
export interface ApiProblem {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

interface ApiErrorBody {
  error?: { code?: unknown; message?: unknown; requestId?: unknown; details?: unknown };
}

export function isApiProblem(value: unknown): value is ApiProblem {
  return typeof value === 'object' && value !== null && 'code' in value && 'status' in value;
}

export function toApiProblem(error: unknown): ApiProblem {
  if (isApiProblem(error)) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, code: 'CLIENT_ERROR', message: 'An unexpected error occurred.' };
  }
  if (error.status === 0) {
    return {
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'The Valryde API could not be reached. Check your connection and try again.',
    };
  }
  const envelope = ((error.error ?? {}) as ApiErrorBody).error;
  return {
    status: error.status,
    code: typeof envelope?.code === 'string' ? envelope.code : `HTTP_${error.status}`,
    message:
      typeof envelope?.message === 'string' ? envelope.message : 'An unexpected error occurred.',
    requestId: typeof envelope?.requestId === 'string' ? envelope.requestId : undefined,
    details: envelope?.details,
  };
}
