export type HealthStatus = 'connected' | 'disconnected' | 'error' | 'idle' | string;

export interface SystemHealth {
  uptime: number;
  database: HealthStatus;
  redis: HealthStatus;
  memoryUsage: number;
  timestamp: string;
  version: string;
}
