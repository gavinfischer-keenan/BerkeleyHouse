/**
 * WebSocket Hub — Real-time event broadcasting from server to all connected clients.
 * 
 * Channels:
 *   aircraft:update    — ADS-B aircraft positions (every ~10s)
 *   ships:update       — AIS vessel positions (every ~10s or real-time)
 *   weather:update     — NWS weather data (every 5min)
 *   buoys:update       — NDBC buoy readings (every 5min)
 *   quakes:update      — USGS earthquake data (every 5min)
 *   alerts:update      — NWS alert data (every 5min)
 *   stations:update    — Weather station readings (every 5min)
 *   currents:update    — Ocean current data (every 5min)
 *   tide:update        — NOAA tide predictions (every 5min)
 *   turbulence:update  — FAA turbulence data (every 5min)
 *   airquality:update  — Air quality data (every 5min)
 *   airport:update     — Airport status data (every 5min)
 *   service:status     — Service registry status changes
 *   ingest:data        — Generic data from external services
 */

import { Server as SocketServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { logger } from "../lib/logger";

let io: SocketServer | null = null;

/** Attach Socket.IO to the HTTP server */
export function initWebSocketHub(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Reduce overhead for kiosk display (single client)
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket) => {
    logger.info({ id: socket.id, transport: socket.conn.transport.name }, "WebSocket client connected");

    socket.on("disconnect", (reason) => {
      logger.info({ id: socket.id, reason }, "WebSocket client disconnected");
    });

    // Clients can request a specific service's latest data
    socket.on("request:data", (channel: string) => {
      const cached = latestData.get(channel);
      if (cached) {
        socket.emit(channel, cached);
      }
    });
  });

  logger.info("WebSocket hub initialized");
  return io;
}

/** Get the Socket.IO server instance */
export function getIO(): SocketServer | null {
  return io;
}

// Cache the latest data for each channel so new clients get immediate data
const latestData = new Map<string, any>();

/** Broadcast data to all connected clients on a channel */
export function broadcast(channel: string, data: any): void {
  latestData.set(channel, data);
  if (io) {
    io.emit(channel, data);
  }
}

/** Get the number of connected clients */
export function getClientCount(): number {
  if (!io) return 0;
  return io.engine.clientsCount;
}

/** Get hub status for the service registry */
export function getHubStatus() {
  return {
    initialized: io !== null,
    clients: getClientCount(),
    channels: Array.from(latestData.keys()),
  };
}
