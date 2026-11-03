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

export interface BrandVoiceInsightsParams {
  windowDays?: number;
  limit?: number;
  channelId?: string;
}

export type BrandVoiceInsightSeverity = 'high' | 'medium' | 'low';

export interface BrandVoiceTopPost {
  id: string;
  title: string;
  text: string;
  publishedAt: string;
  channelId: string;
  channelName: string;
  platform: 'FACEBOOK' | 'THREADS';
  hasMedia: boolean;
  metrics: {
    reactions: number;
    comments: number;
    shares: number;
    reach: number | null;
    impressions: number | null;
  };
  totalInteractions: number;
  rank: number;
  signals: string[];
}

export interface BrandVoiceLesson {
  id: string;
  label: string;
  explanation: string;
  action: string;
  evidencePostIds: string[];
  severity: BrandVoiceInsightSeverity;
}

export interface BrandVoiceInsights {
  topPosts: BrandVoiceTopPost[];
  insights: BrandVoiceLesson[];
  suggestedBrandVoice: {
    writingStyle: string;
    keywordsShouldUse: string[];
    keywordsAvoid: string[];
    fewShotExamples: BrandVoiceExample[];
  };
  meta: {
    sampleSize: number;
    windowDays: number;
    minPostsForInsights: number;
    usedFallback: boolean;
  };
}
