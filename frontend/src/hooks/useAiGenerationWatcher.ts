import { useEffect, useRef, useState } from 'react';
import { useAiGeneration } from '@/hooks/useAi';
import { syncSessionUser } from '@/hooks/useWorkspace';
import { getErrorMessage } from '@/utils/error';

interface AiGenerationWatcherOptions<T> {
  workspaceId: string;
  generationId: string | null;
  setGenerationId: (generationId: string | null) => void;
  isResult: (result: unknown) => result is T;
  resultLabel: string;
  onSuccess: (result: T) => void;
}

export const useAiGenerationWatcher = <T>({
  workspaceId,
  generationId,
  setGenerationId,
  isResult,
  resultLabel,
  onSuccess,
}: AiGenerationWatcherOptions<T>) => {
  const [error, setError] = useState<string | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const generation = useAiGeneration(workspaceId, generationId);

  useEffect(() => {
    const data = generation.data;
    if (!data) return;

    if (data.status === 'SUCCESS') {
      if (isResult(data.result)) {
        setError(null);
        onSuccessRef.current(data.result);
      } else {
        setError(`AI không trả về ${resultLabel} hợp lệ. Credit đã được hoàn.`);
        void syncSessionUser();
      }
      setGenerationId(null);
      return;
    }

    if (data.status === 'FAILED') {
      setError(data.errorMessage ?? `Tạo ${resultLabel} thất bại. Credit đã được hoàn.`);
      setGenerationId(null);
      void syncSessionUser();
    }
  }, [generation.data, isResult, resultLabel, setGenerationId]);

  useEffect(() => {
    if (!generation.isError || !generationId) return;
    setError(getErrorMessage(generation.error));
    setGenerationId(null);
  }, [generation.error, generation.isError, generationId, setGenerationId]);

  return {
    error,
    setError,
    isBusy: Boolean(generationId),
  };
};

export default useAiGenerationWatcher;
