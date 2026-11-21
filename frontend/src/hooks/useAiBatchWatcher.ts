import { useEffect, useRef, useState } from 'react';
import { useAiGenerations } from '@/hooks/useAi';
import { syncSessionUser } from '@/hooks/useWorkspace';
import { isAiTerminal, type AiGeneration, type AiImageResult, type AiTextResult } from '@/services/ai';
import { getErrorMessage } from '@/utils/error';

export interface AiBatchSummary {
  textApplied: boolean;
  imageCount: number;
  failures: string[];
}

interface AiBatchWatcherOptions {
  workspaceId: string;
  generationIds: string[];
  setGenerationIds: (generationIds: string[]) => void;
  onText: (result: AiTextResult) => void;
  onImage: (result: AiImageResult) => void;
  onSettled: (summary: AiBatchSummary) => void;
}

const isTextResult = (result: unknown): result is AiTextResult =>
  Boolean(
    result &&
      typeof result === 'object' &&
      'title' in result &&
      typeof (result as AiTextResult).title === 'string' &&
      'content' in result
  );

const isImageResult = (result: unknown): result is AiImageResult =>
  Boolean(result && typeof result === 'object' && 'media' in result);

const MISSING_MESSAGE = 'Không tìm thấy tiến trình tạo nội dung AI. Credit đã được hoàn.';

export const useAiBatchWatcher = ({
  workspaceId,
  generationIds,
  setGenerationIds,
  onText,
  onImage,
  onSettled,
}: AiBatchWatcherOptions) => {
  const [error, setError] = useState<string | null>(null);
  const handlersRef = useRef({ onText, onImage, onSettled });
  handlersRef.current = { onText, onImage, onSettled };
  const summaryRef = useRef<AiBatchSummary>({ textApplied: false, imageCount: 0, failures: [] });
  const handledRef = useRef(new Set<string>());

  const query = useAiGenerations(workspaceId, generationIds);

  useEffect(() => {
    const generations = query.data;
    if (!generations || generationIds.length === 0) return;

    const byId = new Map<string, AiGeneration>(generations.map((item) => [item.id, item]));
    const summary = summaryRef.current;

    for (const id of generationIds) {
      if (handledRef.current.has(id)) continue;

      const generation = byId.get(id);
      if (!generation) {
        handledRef.current.add(id);
        summary.failures.push(MISSING_MESSAGE);
        continue;
      }
      if (!isAiTerminal(generation.status)) continue;

      handledRef.current.add(id);

      if (generation.status === 'FAILED') {
        summary.failures.push(generation.errorMessage ?? 'Tạo nội dung AI thất bại. Credit đã được hoàn.');
      } else if (generation.type === 'TEXT' && isTextResult(generation.result)) {
        handlersRef.current.onText(generation.result);
        summary.textApplied = true;
      } else if (generation.type === 'IMAGE' && isImageResult(generation.result)) {
        handlersRef.current.onImage(generation.result);
        summary.imageCount += 1;
      } else {
        summary.failures.push('AI không trả về kết quả hợp lệ. Credit đã được hoàn.');
      }
    }

    if (!generationIds.every((id) => handledRef.current.has(id))) return;

    const finished = { ...summary, failures: [...summary.failures] };
    summaryRef.current = { textApplied: false, imageCount: 0, failures: [] };
    handledRef.current = new Set();
    if (finished.failures.length > 0) void syncSessionUser();
    setGenerationIds([]);
    handlersRef.current.onSettled(finished);
  }, [query.data, generationIds, setGenerationIds]);

  useEffect(() => {
    if (!query.isError || generationIds.length === 0) return;
    setError(getErrorMessage(query.error));
    summaryRef.current = { textApplied: false, imageCount: 0, failures: [] };
    handledRef.current = new Set();
    setGenerationIds([]);
  }, [query.error, query.isError, generationIds.length, setGenerationIds]);

  return { error, setError, isBusy: generationIds.length > 0 };
};

export default useAiBatchWatcher;
