export interface BrandVoiceExample {
  title?: string;
  content: string;
}

export interface BrandVoice {
  industry: string;
  targetAudience: string;
  writingStyle: string;
  keywordsShouldUse: string[];
  keywordsAvoid: string[];
  fewShotExamples: BrandVoiceExample[];
}

export interface BrandVoiceResult {
  brandVoice: BrandVoice | null;
  isConfigured: boolean;
}
