// The closed error contract (docs/api-and-data.md §5.3) and the one Fastify error handler that renders it.
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

/** §5.3, verbatim. `EXPIRED`/`OVER_CAP`/… are tap reason codes, never HTTP error codes. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ACCOUNT_EXISTS'
  | 'NOT_FOUND'
  | 'CARD_NOT_ENROLLED'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'CARD_ALREADY_ENROLLED'
  | 'INVALID_STATE'
  | 'OCR_UNAVAILABLE'
  | 'PHOTO_MISMATCH'
  | 'PHOTO_CONFIRMATION_REQUIRED'
  | 'STATION_FROZEN'
  | 'CHAIN_ERROR'
  | 'INTERNAL';

/** A route-level failure the services raise; the handler renders `{ error: { code, message } }` with `statusCode`. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** First zod issue as "<path>: <message>" (§5.3: the message names the field). */
function zodMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return 'invalid request';
  const path = issue.path.join('.');
  return path === '' ? issue.message : `${path}: ${issue.message}`;
}

/**
 * `ApiError` keeps its code and status; a zod failure is 400 `VALIDATION_ERROR`; a Fastify client error (body parse,
 * payload too large, unsupported media type) keeps its 4xx status as `VALIDATION_ERROR`; anything else is 500
 * `INTERNAL` with a fixed message — the thrown message is logged, never returned.
 */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) request.log.error({ err: error }, 'route error');
    void reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    void reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: zodMessage(error) } });
    return;
  }
  const status = error.statusCode;
  if (typeof status === 'number' && status >= 400 && status <= 499) {
    void reply.code(status).send({ error: { code: 'VALIDATION_ERROR', message: error.message } });
    return;
  }
  request.log.error({ err: error }, 'unhandled route error');
  void reply.code(500).send({ error: { code: 'INTERNAL', message: 'Internal error' } });
}
