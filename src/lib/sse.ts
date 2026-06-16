import { NextRequest } from "next/server";

const DEFAULT_HEARTBEAT_MS = 20_000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface SSEError {
  message: string;
  code?: string;
}

export interface SSEOptions<T> {
  initial: T;
  fetch: () => Promise<T | null>;
  isTerminal: (value: T) => boolean;
  serialize: (value: T) => unknown;
  isComplete?: (value: T) => boolean;
  isError?: (value: T) => boolean;
  getError?: (value: T) => SSEError | null;
  heartbeatMs?: number;
  timeoutMs?: number;
}

export function createSSEStream<T>(
  request: NextRequest,
  options: SSEOptions<T>
): ReadableStream {
  const {
    initial,
    fetch,
    isTerminal,
    serialize,
    isComplete,
    isError,
    getError,
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const encoder = new TextEncoder();
  let lastPayload = JSON.stringify(serialize(initial));
  let lastChangeTime = Date.now();
  let closed = false;

  function markChanged(value: T): void {
    lastPayload = JSON.stringify(serialize(value));
    lastChangeTime = Date.now();
  }

  return new ReadableStream({
    start(controller) {
      const intervals: {
        heartbeat?: ReturnType<typeof setInterval>;
        poll?: ReturnType<typeof setInterval>;
        timeout?: ReturnType<typeof setInterval>;
      } = {};

      function close(): void {
        if (closed) return;
        closed = true;
        if (intervals.heartbeat) clearInterval(intervals.heartbeat);
        if (intervals.poll) clearInterval(intervals.poll);
        if (intervals.timeout) clearInterval(intervals.timeout);
        controller.close();
      }

      function send(event: string, data: unknown): void {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      function sendProgress(value: T): void {
        const serialized = serialize(value);
        if (JSON.stringify(serialized) !== lastPayload) {
          markChanged(value);
        }
        send("progress", serialized);
      }

      function sendError(error: SSEError): void {
        send("error", error);
      }

      function sendComplete(value: T): void {
        send("complete", serialize(value));
      }

      function handleTerminal(value: T): boolean {
        if (isError?.(value)) {
          const error = getError?.(value) ?? { message: "Error desconocido" };
          sendError(error);
          close();
          return true;
        }

        if (isComplete?.(value)) {
          sendComplete(value);
          close();
          return true;
        }

        if (isTerminal(value)) {
          close();
          return true;
        }

        return false;
      }

      async function poll(): Promise<void> {
        if (closed || request.signal.aborted) {
          close();
          return;
        }

        try {
          const current = await fetch();

          if (!current) {
            close();
            return;
          }

          sendProgress(current);

          if (handleTerminal(current)) {
            return;
          }
        } catch {
          // Ignorar errores de polling puntuales; el timeout cerrará la conexión.
        }
      }

      function checkTimeout(): void {
        if (closed) return;
        if (Date.now() - lastChangeTime > timeoutMs) {
          sendError({ message: "La conexión ha excedido el tiempo de espera." });
          close();
        }
      }

      sendProgress(initial);

      if (handleTerminal(initial)) {
        return;
      }

      intervals.heartbeat = setInterval(() => {
        if (closed) return;
        send("heartbeat", { timestamp: Date.now() });
      }, heartbeatMs);

      intervals.poll = setInterval(() => {
        void poll();
      }, 500);

      intervals.timeout = setInterval(() => {
        checkTimeout();
      }, 1000);

      request.signal.addEventListener("abort", () => {
        if (intervals.heartbeat) clearInterval(intervals.heartbeat);
        if (intervals.poll) clearInterval(intervals.poll);
        if (intervals.timeout) clearInterval(intervals.timeout);
        close();
      });
    },
    cancel() {
      closed = true;
    },
  });
}
