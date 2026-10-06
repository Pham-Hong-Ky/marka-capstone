import { useQuery } from '@tanstack/react-query';
import healthApi from '@/services/health.api';

export const useHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: healthApi.getHealth,
    refetchInterval: 30000,
    retry: false,
  });
