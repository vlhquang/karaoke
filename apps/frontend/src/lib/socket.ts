"use client";

import { env } from "./env";

interface SocketLike {
  connected: boolean;
  connect: () => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string) => void;
  emit: (event: string, payload: unknown, ack?: (response: any) => void) => void;
}

declare global {
  interface Window {
    io?: (url: string, options: Record<string, unknown>) => SocketLike;
  }
}

const SOCKET_IO_CDN = "https://cdn.socket.io/4.8.1/socket.io.min.js";

let socketInstance: SocketLike | null = null;
let loaderPromise: Promise<void> | null = null;

const loadSocketIoClient = async (): Promise<void> => {
  if (window.io) {
    return;
  }

  if (loaderPromise) {
    await loaderPromise;
    return;
  }

  loaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("socket-io-cdn");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Socket.IO CDN load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "socket-io-cdn";
    script.src = SOCKET_IO_CDN;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Socket.IO CDN load failed"));
    document.body.appendChild(script);
  });

  await loaderPromise;
};

export const getSocket = async (): Promise<SocketLike> => {
  if (socketInstance) {
    return socketInstance;
  }

  await loadSocketIoClient();
  if (!window.io) {
    throw new Error("Socket.IO client is unavailable");
  }

  const socketBase = env.socketUrl || window.location.origin;
  socketInstance = window.io(socketBase, {
    autoConnect: false,
    transports: ["websocket", "polling"]
  });

  return socketInstance;
};
