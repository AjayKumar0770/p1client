import { useEffect, useRef } from "react";
import { useStreamStore } from "../stores/streamStore";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

let globalWs: WebSocket | null = null;
let globalWsPromise: Promise<WebSocket> | null = null;
const globalSubscriptions = new Set<string>();
const subscriptionRefs = new Map<string, number>();

// Frame buffer queue for tick updates
let tickBuffer: {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}[] = [];



function processTickBuffer() {
  if (tickBuffer.length > 0) {
    const ticks = [...tickBuffer];
    tickBuffer = [];
    useStreamStore.getState().updatePrices(ticks);
  }
  requestAnimationFrame(processTickBuffer);
}

// Start buffer loop on client
if (typeof window !== "undefined") {
  requestAnimationFrame(processTickBuffer);
}

function getWebSocket(): Promise<WebSocket> {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    return Promise.resolve(globalWs);
  }
  if (globalWsPromise) {
    return globalWsPromise;
  }

  globalWsPromise = new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        globalWs = ws;
        globalWsPromise = null;
        // Resubscribe to existing subscriptions
        globalSubscriptions.forEach((sym) => {
          ws.send(JSON.stringify({ type: "subscribe", channel: `subscribe:price:${sym}` }));
        });
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "ticks" && Array.isArray(payload.data)) {
            tickBuffer.push(...payload.data);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onclose = () => {
        globalWs = null;
        globalWsPromise = null;
        // Reconnect after 3 seconds
        setTimeout(() => {
          getWebSocket().catch((err) => console.error("WS reconnect failed:", err));
        }, 3000);
      };

      ws.onerror = (err) => {
        reject(err);
      };
    } catch (error) {
      reject(error);
    }
  });

  return globalWsPromise;
}

export function useWebSocket(symbols: string[]) {
  const prevSymbolsRef = useRef<string[]>([]);

  useEffect(() => {
    const prevSymbols = prevSymbolsRef.current;
    const currentSet = new Set(symbols);
    const prevSet = new Set(prevSymbols);

    const toSubscribe = symbols.filter((s) => !prevSet.has(s));
    const toUnsubscribe = prevSymbols.filter((s) => !currentSet.has(s));

    getWebSocket()
      .then((ws) => {
        toSubscribe.forEach((sym) => {
          const refs = subscriptionRefs.get(sym) || 0;
          subscriptionRefs.set(sym, refs + 1);

          if (refs === 0) {
            globalSubscriptions.add(sym);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "subscribe", channel: `subscribe:price:${sym}` }));
            }
          }
        });

        toUnsubscribe.forEach((sym) => {
          const refs = subscriptionRefs.get(sym) || 0;
          if (refs <= 1) {
            subscriptionRefs.delete(sym);
            globalSubscriptions.delete(sym);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "unsubscribe", channel: `unsubscribe:price:${sym}` }));
            }
          } else {
            subscriptionRefs.set(sym, refs - 1);
          }
        });
      })
      .catch((err) => console.error("Failed to connect WS in hook:", err));

    prevSymbolsRef.current = symbols;

    return () => {
      // Unsubscribe all active symbols when hook unmounts
      getWebSocket()
        .then((ws) => {
          prevSymbolsRef.current.forEach((sym) => {
            const refs = subscriptionRefs.get(sym) || 0;
            if (refs <= 1) {
              subscriptionRefs.delete(sym);
              globalSubscriptions.delete(sym);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "unsubscribe", channel: `unsubscribe:price:${sym}` }));
              }
            } else {
              subscriptionRefs.set(sym, refs - 1);
            }
          });
        })
        .catch((err) => console.error("Failed to cleanup WS in hook:", err));
    };
  }, [symbols]);
}
