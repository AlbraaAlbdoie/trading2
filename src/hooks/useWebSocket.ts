// ═══════════════════════════════════════════════════════════════════════════
// NEXUS ALPHA — WebSocket Connection Manager Hook
// ═══════════════════════════════════════════════════════════════════════════
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WsStatus } from "@/lib/types";

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onStatusChange?: (status: WsStatus) => void;
  reconnectDelay?: number;
  maxRetries?: number;
  enabled?: boolean;
}

interface UseWebSocketReturn {
  status: WsStatus;
  reconnect: () => void;
  disconnect: () => void;
}

export function useWebSocket({
  url,
  onMessage,
  onStatusChange,
  reconnectDelay = 3000,
  maxRetries = 10,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const updateStatus = useCallback(
    (s: WsStatus) => {
      setStatus(s);
      onStatusChange?.(s);
    },
    [onStatusChange],
  );

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      updateStatus("connecting");
      const ws = new WebSocket(url);

      ws.onopen = () => {
        retriesRef.current = 0;
        updateStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch {
          // skip malformed messages
        }
      };

      ws.onerror = () => {
        updateStatus("error");
      };

      ws.onclose = () => {
        updateStatus("disconnected");
        wsRef.current = null;

        // Auto-reconnect
        if (enabled && retriesRef.current < maxRetries) {
          retriesRef.current += 1;
          const delay = reconnectDelay * Math.min(retriesRef.current, 5);
          timerRef.current = setTimeout(connect, delay);
        }
      };

      wsRef.current = ws;
    } catch {
      updateStatus("error");
    }
  }, [url, enabled, reconnectDelay, maxRetries, updateStatus]);

  const disconnect = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent auto-reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    updateStatus("disconnected");
  }, [updateStatus]);

  const reconnect = useCallback(() => {
    retriesRef.current = 0;
    disconnect();
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { status, reconnect, disconnect };
}
