/**
 * data-bus.js — WebSocket consumer + event dispatcher
 * 
 * Connects to the server via Socket.IO and dispatches real-time data events.
 * Falls back to HTTP polling if WebSocket is unavailable.
 * 
 * Usage:
 *   import { dataBus } from './modules/data-bus.js';
 *   dataBus.on('aircraft:update', (data) => { ... });
 *   dataBus.on('ships:update', (data) => { ... });
 */

const DATA_BUS_VERSION = '1.0.0';

class DataBus {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
    this.fallbackPollers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000;
  }

  /** Initialize the WebSocket connection */
  init() {
    // Socket.IO client loaded from CDN in index.html
    if (typeof io === 'undefined') {
      console.warn('[DataBus] Socket.IO client not available, using HTTP polling only');
      return;
    }

    const wsUrl = window.location.origin;
    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('[DataBus] WebSocket connected:', this.socket.id);
      this.connected = true;
      this.reconnectAttempts = 0;
      this._stopFallbackPolling();
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[DataBus] WebSocket disconnected:', reason);
      this.connected = false;
      this._startFallbackPolling();
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[DataBus] WebSocket error:', err.message);
      this.reconnectAttempts++;
    });

    // Wire all registered channels to Socket.IO events
    this.listeners.forEach((handlers, channel) => {
      this.socket.on(channel, (data) => {
        handlers.forEach(fn => {
          try { fn(data); } catch(e) { console.error(`[DataBus] Handler error on ${channel}:`, e); }
        });
      });
    });
  }

  /** Register a listener for a data channel */
  on(channel, handler) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);

      // Only wire a new socket.on when this is the FIRST handler for this channel.
      // Subsequent handlers are dispatched by the existing socket listener below.
      if (this.socket) {
        this.socket.on(channel, (data) => {
          const handlers = this.listeners.get(channel) ?? [];
          handlers.forEach(fn => {
            try { fn(data); } catch(e) { console.error(`[DataBus] Handler error on ${channel}:`, e); }
          });
        });
      }
    }
    this.listeners.get(channel).push(handler);
  }

  /** Remove a listener */
  off(channel, handler) {
    const handlers = this.listeners.get(channel);
    if (!handlers) return;
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  }

  /** Request the latest cached data for a channel */
  requestLatest(channel) {
    if (this.socket && this.connected) {
      this.socket.emit('request:data', channel);
    }
  }

  /** Register a fallback HTTP poll for when WebSocket is down */
  registerFallback(channel, fetchFn, intervalMs) {
    this.fallbackPollers.set(channel, {
      fetchFn,
      intervalMs,
      timerId: null,
      active: false,
    });
  }

  /** Check if WebSocket is connected */
  isConnected() {
    return this.connected;
  }

  /** Get connection status for display */
  getStatus() {
    return {
      connected: this.connected,
      transport: this.socket?.io?.engine?.transport?.name || 'none',
      reconnectAttempts: this.reconnectAttempts,
      channels: Array.from(this.listeners.keys()),
    };
  }

  // --- Internal ---

  _startFallbackPolling() {
    this.fallbackPollers.forEach((poller, channel) => {
      if (poller.active) return;
      poller.active = true;
      poller.timerId = setInterval(poller.fetchFn, poller.intervalMs);
      console.log(`[DataBus] Started fallback polling for ${channel} (${poller.intervalMs}ms)`);
    });
  }

  _stopFallbackPolling() {
    this.fallbackPollers.forEach((poller, channel) => {
      if (!poller.active) return;
      poller.active = false;
      if (poller.timerId) {
        clearInterval(poller.timerId);
        poller.timerId = null;
      }
      console.log(`[DataBus] Stopped fallback polling for ${channel}`);
    });
  }
}

// Singleton instance
const dataBus = new DataBus();

// Export for use by other modules (or attach to window for non-module scripts)
if (typeof window !== 'undefined') {
  window.dataBus = dataBus;
}
