export type AiGenType = 'TEXT' | 'IMAGE';
export type AiGenStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface AiTextResult {
  title: string;
  content: Record<string, unknown>;
}

export interface AiImageResult {
  media: {
    id: string;
    url: string;
    mimeType: string | null;
    size: number;
  };
}

export interface AiGeneration {
  id: string;
  type: AiGenType;
  status: AiGenStatus;
  provider: string;
  model: string;
  postId: string | null;
  creditCost: number;
  result: AiTextResult | AiImageResult | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartTextPayload {
  topic: string;
  instructions?: string;
  postId?: string;
}

export interface StartImagePayload {
  postId?: string;
  title?: string;
  content?: object;
  prompt?: string;
}

export interface StartGenerationResponse {
  generationId: string;
  status: 'PENDING';
  postId: string | null;
  creditCost: number;
  remainingCredit: number;
}

export const isAiTerminal = (status: AiGenStatus): boolean =>
  status === 'SUCCESS' || status === 'FAILED';
