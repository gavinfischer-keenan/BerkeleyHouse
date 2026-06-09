/**
 * Service Registry — Dynamic service discovery and health tracking.
 * 
 * Each data source (local hardware, remote API, external service) registers
 * itself here. The frontend can discover available services via /api/services
 * and external devices can push data via /api/ingest/:name.
 */

import { logger } from "../lib/logger";
import { broadcast } from "./ws-hub";

export type ServiceType = "poll" | "stream" | "push";
export type ServiceSource = "remote" | "local";
export type ServiceStatus = "online" | "offline" | "degraded" | "initializing";

export interface ServiceInfo {
  name: string;
  displayName: string;
  type: ServiceType;
  source: ServiceSource;
  status: ServiceStatus;
  lastUpdate: number;
  updateCount: number;
  errorCount: number;
  lastError: string | null;
  config: Record<string, string>;  // masked sensitive values
  metadata: Record<string, any>;   // arbitrary service metadata
}

// In-memory registry
const services = new Map<string, ServiceInfo>();

// Data buffer for push/ingest services (last N readings)
const dataBuffers = new Map<string, { timestamp: number; data: any }[]>();
const MAX_BUFFER_SIZE = 100;

/** Register a service with the registry */
export function registerService(
  name: string,
  displayName: string,
  type: ServiceType,
  source: ServiceSource,
  config: Record<string, string> = {},
  metadata: Record<string, any> = {}
): void {
  const info: ServiceInfo = {
    name,
    displayName,
    type,
    source,
    status: "initializing",
    lastUpdate: 0,
    updateCount: 0,
    errorCount: 0,
    lastError: null,
    config: maskSensitiveConfig(config),
    metadata,
  };
  services.set(name, info);
  logger.info({ service: name, type, source }, "Service registered");
}

/** Update a service's status */
export function updateServiceStatus(name: string, status: ServiceStatus, error?: string): void {
  const svc = services.get(name);
  if (!svc) return;
  svc.status = status;
  if (error) {
    svc.lastError = error;
    svc.errorCount++;
  }
  broadcast("service:status", { name, status, error });
}

/** Record a successful data update for a service */
export function recordServiceUpdate(name: string): void {
  const svc = services.get(name);
  if (!svc) return;
  svc.lastUpdate = Date.now();
  svc.updateCount++;
  if (svc.status !== "online") {
    svc.status = "online";
    broadcast("service:status", { name, status: "online" });
  }
}

/** Store data from a push/ingest source */
export function ingestData(name: string, data: any, metadata?: Record<string, any>): void {
  // Auto-register if new
  if (!services.has(name)) {
    registerService(name, name, "push", "local", {}, metadata || {});
  }

  const entry = { timestamp: Date.now(), data };
  
  if (!dataBuffers.has(name)) {
    dataBuffers.set(name, []);
  }
  const buffer = dataBuffers.get(name)!;
  buffer.push(entry);
  while (buffer.length > MAX_BUFFER_SIZE) {
    buffer.shift();
  }

  recordServiceUpdate(name);
  broadcast(`ingest:${name}`, entry);
}

/** Get latest ingested data for a service */
export function getLatestIngest(name: string): { timestamp: number; data: any } | null {
  const buffer = dataBuffers.get(name);
  if (!buffer || buffer.length === 0) return null;
  return buffer[buffer.length - 1];
}

/** Get ingested data history for a service */
export function getIngestHistory(name: string, limit = 50): { timestamp: number; data: any }[] {
  const buffer = dataBuffers.get(name);
  if (!buffer) return [];
  return buffer.slice(-limit);
}

/** Get all registered services */
export function getAllServices(): ServiceInfo[] {
  return Array.from(services.values());
}

/** Get a specific service */
export function getService(name: string): ServiceInfo | undefined {
  return services.get(name);
}

/** Mask sensitive config values (API keys, passwords) */
function maskSensitiveConfig(config: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (key.toLowerCase().includes("key") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("password")) {
      masked[key] = value ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : "(not set)";
    } else {
      masked[key] = value;
    }
  }
  return masked;
}
