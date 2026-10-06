import httpClient from './httpClient';
import { unwrap } from './http';
import type { ApiResponse, SystemHealth } from '@/types';

export const getHealth = async (): Promise<SystemHealth> =>
  unwrap(await httpClient.get<ApiResponse<SystemHealth>>('/health'));

export default { getHealth };
