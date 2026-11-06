// GET /api/stream (docs/api-and-data.md §5.4): every state change as an SSE frame, no replay, `: ping` every 15 s.
import type { FastifyInstance } from 'fastify';
import type { SseBus } from '../services/sse';

export const SSE_HEARTBEAT_MS = 15_000;

export function registerStreamRoutes(app: FastifyInstance, deps: { bus: SseBus }): void {
  app.get('/api/stream', (request, reply) => {
    // Hijacked: the reply is a long-lived raw socket, so the onSend hook (and its no-cache rule) is bypassed here.
    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      // no-transform: the `compression` middleware behind the Next.js rewrite skips such responses; gzip would buffer events.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // Push the header block and a first body byte out now: a proxy (Caddy, the Next.js dev rewrite) otherwise waits
    // for the first body byte, i.e. the first 15 s heartbeat. The comment is ignored by EventSource.
    response.flushHeaders();
    response.write(': connected\n\n');

    let lastId = 0;
    const unsubscribe = deps.bus.subscribe((event, data) => {
      lastId += 1;
      response.write(`id: ${lastId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
    const heartbeat = setInterval(() => response.write(': ping\n\n'), SSE_HEARTBEAT_MS);
    const close = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    request.raw.on('close', close);
    response.on('error', close);
  });
}
