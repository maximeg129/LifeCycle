'use client';

type ErrorEvents = {
  'permission-error': (error: any) => void;
};

class ErrorEmitter {
  private listeners: { [K in keyof ErrorEvents]?: ErrorEvents[K][] } = {};

  emit<K extends keyof ErrorEvents>(event: K, ...args: Parameters<ErrorEvents[K]>) {
    this.listeners[event]?.forEach((listener) => (listener as any)(...args));
  }

  on<K extends keyof ErrorEvents>(event: K, listener: ErrorEvents[K]) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]?.push(listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof ErrorEvents>(event: K, listener: ErrorEvents[K]) {
    this.listeners[event] = this.listeners[event]?.filter((l) => l !== listener);
  }
}

export const errorEmitter = new ErrorEmitter();
