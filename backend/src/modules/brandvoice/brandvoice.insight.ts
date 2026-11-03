import type { SocialPlatform } from '@prisma/client';

export interface InsightPost {
  id: string;
  title: string;
  text: string;
  publishedAt: Date;
  channelId: string;
  channelName: string;
  platform: SocialPlatform;
  hasMedia: boolean;
  metrics: {
    reactions: number;
    comments: number;
    shares: number;
    reach: number | null;
    impressions: number | null;
  };
}

export interface RankedInsightPost extends InsightPost {
  totalInteractions: number;
  rank: number;
  signals: string[];
}

export type InsightSeverity = 'high' | 'medium' | 'low';

export interface BrandVoiceLesson {
  id: string;
  label: string;
  explanation: string;
  action: string;
  evidencePostIds: string[];
  severity: InsightSeverity;
}

export interface SuggestedBrandVoice {
  writingStyle: string;
  keywordsShouldUse: string[];
  keywordsAvoid: string[];
  fewShotExamples: Array<{ title?: string; content: string }>;
}

export interface BrandVoiceInsights {
  topPosts: RankedInsightPost[];
  insights: BrandVoiceLesson[];
  suggestedBrandVoice: SuggestedBrandVoice;
  meta: {
    sampleSize: number;
    windowDays: number;
    minPostsForInsights: number;
    usedFallback: boolean;
  };
}

export const BRAND_VOICE_INSIGHT_MIN_POSTS = 10;

const MIN_GROUP_SIZE = 3;
const MAX_GROUP_SIZE = 10;
const MAX_INSIGHTS = 6;
const MAX_KEYWORDS = 8;
const MAX_EXAMPLES = 3;
const MAX_EXAMPLE_LENGTH = 5000;
const MAX_WRITING_STYLE_LENGTH = 300;
const RATIO_THRESHOLD = 0.25;
const DUPLICATE_SIMILARITY = 0.98;

const CTA_PATTERN =
  /bình luận|comment|nhắn tin|inbox|đặt hàng|đăng ký|lưu bài|chia sẻ|liên hệ|xem chi tiết/i;
const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const LINK_PATTERN = /https?:\/\//i;

const totalInteractions = (post: InsightPost): number =>
  post.metrics.reactions + post.metrics.comments + post.metrics.shares;

const normalizeForCompare = (text: string): string =>
  text
    .toLowerCase()
    .replace(LINK_PATTERN, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const wordSet = (text: string): Set<string> =>
  new Set(normalizeForCompare(text).split(' ').filter(Boolean));

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection += 1;
  }

  return intersection / (a.size + b.size - intersection);
};

interface TextFeatures {
  words: number;
  paragraphs: number;
  avgSentenceWords: number;
  emojiCount: number;
  hashtagCount: number;
  startsWithQuestion: boolean;
  hasEndingCTA: boolean;
  hasLink: boolean;
  hasNumber: boolean;
  hasBullet: boolean;
  uppercaseRatio: number;
  firstPerson: boolean;
}

const extractFeatures = (text: string): TextFeatures => {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed
    .split(/[.!?…]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const letters = trimmed.match(/\p{L}/gu) ?? [];
  const uppercase = trimmed.match(/\p{Lu}/gu) ?? [];

  return {
    words: words.length,
    paragraphs: trimmed.split(/\n{2,}/).filter((part) => part.trim()).length || 1,
    avgSentenceWords: words.length / Math.max(1, sentences.length),
    emojiCount: (trimmed.match(EMOJI_PATTERN) ?? []).length,
    hashtagCount: (trimmed.match(HASHTAG_PATTERN) ?? []).length,
    startsWithQuestion: /^[^.!?…]*\?/.test(trimmed),
    hasEndingCTA:
      CTA_PATTERN.test(trimmed.slice(-200)) || /\?[^.!?…]*$/.test(trimmed),
    hasLink: LINK_PATTERN.test(trimmed),
    hasNumber: /\d/.test(trimmed),
    hasBullet: /(^|\n)\s*([-•*]|\d+[.)])\s+/m.test(trimmed),
    uppercaseRatio: letters.length > 0 ? uppercase.length / letters.length : 0,
    firstPerson: /\b(mình|tôi|chúng tôi|chúng mình)\b/i.test(trimmed),
  };
};

const buildSignals = (post: InsightPost, features: TextFeatures): string[] => {
  const signals: string[] = [];

  if (features.startsWithQuestion) signals.push('Mở bằng câu hỏi');
  if (post.hasMedia) signals.push('Có ảnh/video');
  if (features.hasEndingCTA) signals.push('Có CTA');
  if (features.hashtagCount > 0) signals.push(`${features.hashtagCount} hashtag`);
  if (features.emojiCount > 0) signals.push(`${features.emojiCount} emoji`);
  if (features.hasLink) signals.push('Có link ngoài');
  if (features.hasNumber) signals.push('Có số liệu');

  return signals.slice(0, 4);
};

const dedupePosts = (posts: InsightPost[]): InsightPost[] => {
  const sorted = [...posts].sort(
    (a, b) =>
      totalInteractions(b) - totalInteractions(a) ||
      b.publishedAt.getTime() - a.publishedAt.getTime()
  );
  const kept: InsightPost[] = [];
  const keptWords: Set<string>[] = [];

  for (const post of sorted) {
    const words = wordSet(post.text);
    if (words.size === 0) continue;

    const isDuplicate = keptWords.some(
      (existing) => jaccard(words, existing) >= DUPLICATE_SIMILARITY
    );

    if (!isDuplicate) {
      kept.push(post);
      keptWords.push(words);
    }
  }

  return kept;
};

const median = (values: number[]): number => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

const round = (value: number): number => Math.round(value);

const severityOf = (weight: number): InsightSeverity => {
  if (weight >= 0.5) return 'high';
  if (weight >= 0.35) return 'medium';
  return 'low';
};

interface InsightCandidate {
  insight: BrandVoiceLesson;
  weight: number;
}

const buildRatioCandidate = ({
  id,
  label,
  action,
  description,
  topHits,
  bottomHits,
  topGroup,
  bottomGroup,
  reverse = false,
}: {
  id: string;
  label: string;
  action: string;
  description: (topCount: number, bottomCount: number) => string;
  topHits: InsightPost[];
  bottomHits: InsightPost[];
  topGroup: InsightPost[];
  bottomGroup: InsightPost[];
  reverse?: boolean;
}): InsightCandidate | null => {
  const topRatio = topHits.length / topGroup.length;
  const bottomRatio = bottomHits.length / bottomGroup.length;
  const weight = reverse ? bottomRatio - topRatio : topRatio - bottomRatio;

  if (weight < RATIO_THRESHOLD) return null;

  return {
    weight,
    insight: {
      id,
      label,
      explanation: description(topHits.length, bottomHits.length),
      action,
      evidencePostIds: (reverse ? bottomHits : topHits).map((post) => post.id).slice(0, 5),
      severity: severityOf(weight),
    },
  };
};

const buildInsightCandidates = (
  topGroup: InsightPost[],
  bottomGroup: InsightPost[]
): InsightCandidate[] => {
  const topFeatures = topGroup.map((post) => extractFeatures(post.text));
  const bottomFeatures = bottomGroup.map((post) => extractFeatures(post.text));
  const candidates: Array<InsightCandidate | null> = [];

  const ratio = (
    id: string,
    label: string,
    action: string,
    topHits: InsightPost[],
    bottomHits: InsightPost[],
    description: (topCount: number, bottomCount: number) => string,
    reverse = false
  ) =>
    buildRatioCandidate({
      id,
      label,
      action,
      description,
      topHits,
      bottomHits,
      topGroup,
      bottomGroup,
      reverse,
    });

  candidates.push(
    ratio(
      'hook_question',
      'Mở bằng câu hỏi',
      'Mở bài bằng một câu hỏi đúng nỗi đau hoặc sự tò mò của khách hàng.',
      topGroup.filter((_, index) => topFeatures[index]!.startsWithQuestion),
      bottomGroup.filter((_, index) => bottomFeatures[index]!.startsWithQuestion),
      (topCount, bottomCount) =>
        `${topCount}/${topGroup.length} bài top mở bằng câu hỏi, so với ${bottomCount}/${bottomGroup.length} bài kém.`
    )
  );

  candidates.push(
    ratio(
      'cta',
      'Kết bài có CTA',
      'Kết bài bằng CTA cụ thể: bình luận, nhắn tin, lưu bài hoặc đặt lịch.',
      topGroup.filter((_, index) => topFeatures[index]!.hasEndingCTA),
      bottomGroup.filter((_, index) => bottomFeatures[index]!.hasEndingCTA),
      (topCount, bottomCount) =>
        `${topCount}/${topGroup.length} bài top có CTA, so với ${bottomCount}/${bottomGroup.length} bài kém.`
    )
  );

  candidates.push(
    ratio(
      'media',
      'Có ảnh hoặc video',
      'Thêm ảnh hoặc video cho mỗi bài để tăng khả năng dừng mắt.',
      topGroup.filter((post) => post.hasMedia),
      bottomGroup.filter((post) => post.hasMedia),
      (topCount, bottomCount) =>
        `${topCount}/${topGroup.length} bài top có ảnh/video, so với ${bottomCount}/${bottomGroup.length} bài kém.`
    )
  );

  candidates.push(
    ratio(
      'bullet',
      'Dùng gạch đầu dòng',
      'Dùng 3-5 gạch đầu dòng khi nội dung có nhiều ý cần dễ đọc.',
      topGroup.filter((_, index) => topFeatures[index]!.hasBullet),
      bottomGroup.filter((_, index) => bottomFeatures[index]!.hasBullet),
      (topCount, bottomCount) =>
        `${topCount}/${topGroup.length} bài top dùng gạch đầu dòng, so với ${bottomCount}/${bottomGroup.length} bài kém.`
    )
  );

  candidates.push(
    ratio(
      'first_person',
      'Xưng hô gần gũi',
      'Dùng xưng hô gần gũi (mình/bạn) để bài viết có cảm giác trò chuyện.',
      topGroup.filter((_, index) => topFeatures[index]!.firstPerson),
      bottomGroup.filter((_, index) => bottomFeatures[index]!.firstPerson),
      (topCount, bottomCount) =>
        `${topCount}/${topGroup.length} bài top dùng xưng hô gần gũi, so với ${bottomCount}/${bottomGroup.length} bài kém.`
    )
  );

  candidates.push(
    ratio(
      'external_link',
      'Hạn chế link ngoài',
      'Hạn chế link ngoài trong caption; đưa link vào bình luận nếu cần.',
      topGroup.filter((_, index) => topFeatures[index]!.hasLink),
      bottomGroup.filter((_, index) => bottomFeatures[index]!.hasLink),
      (topCount, bottomCount) =>
        `${bottomCount}/${bottomGroup.length} bài kém có link ngoài, so với ${topCount}/${topGroup.length} bài top.`,
      true
    )
  );

  const topWords = topFeatures.map((feature) => feature.words);
  const bottomWords = bottomFeatures.map((feature) => feature.words);
  const topMedianWords = median(topWords);
  const bottomMedianWords = median(bottomWords);

  if (topMedianWords >= bottomMedianWords * 1.25 && topMedianWords - bottomMedianWords >= 10) {
    const min = Math.max(20, round(topMedianWords * 0.75));
    const max = round(topMedianWords * 1.25);
    candidates.push({
      weight: (topMedianWords - bottomMedianWords) / Math.max(topMedianWords, 1),
      insight: {
        id: 'length_longer',
        label: 'Viết đủ ý',
        explanation: `Bài top dài trung bình ${round(topMedianWords)} từ, bài kém ${round(bottomMedianWords)} từ.`,
        action: `Viết đủ ý, khoảng ${min}-${max} từ thay vì caption quá ngắn.`,
        evidencePostIds: topGroup.map((post) => post.id).slice(0, 5),
        severity: 'medium',
      },
    });
  } else if (
    bottomMedianWords >= topMedianWords * 1.25 &&
    bottomMedianWords - topMedianWords >= 10
  ) {
    const min = Math.max(20, round(topMedianWords * 0.75));
    const max = round(topMedianWords * 1.25);
    candidates.push({
      weight: (bottomMedianWords - topMedianWords) / Math.max(bottomMedianWords, 1),
      insight: {
        id: 'length_shorter',
        label: 'Rút ngắn bài',
        explanation: `Bài top dài trung bình ${round(topMedianWords)} từ, bài kém ${round(bottomMedianWords)} từ.`,
        action: `Rút ngắn còn khoảng ${min}-${max} từ để bài dễ đọc hơn.`,
        evidencePostIds: topGroup.map((post) => post.id).slice(0, 5),
        severity: 'medium',
      },
    });
  }

  const topParagraphs = median(topFeatures.map((feature) => feature.paragraphs));
  const bottomParagraphs = median(bottomFeatures.map((feature) => feature.paragraphs));

  if (topParagraphs - bottomParagraphs >= 1) {
    candidates.push({
      weight: 0.4,
      insight: {
        id: 'paragraphs',
        label: 'Chia đoạn rõ ràng',
        explanation: `Bài top thường có ${round(topParagraphs)} đoạn, bài kém ${round(bottomParagraphs)} đoạn.`,
        action: 'Chia bài thành 3-5 đoạn ngắn, mỗi đoạn 2-4 câu.',
        evidencePostIds: topGroup.map((post) => post.id).slice(0, 5),
        severity: 'medium',
      },
    });
  }

  const topHashtags = median(topFeatures.map((feature) => feature.hashtagCount));
  const bottomHashtags = median(bottomFeatures.map((feature) => feature.hashtagCount));

  if (topHashtags >= 1 && topHashtags <= 5 && (bottomHashtags < 1 || bottomHashtags > 5)) {
    candidates.push({
      weight: 0.35,
      insight: {
        id: 'hashtags',
        label: 'Số hashtag vừa phải',
        explanation: `Bài top dùng trung bình ${round(topHashtags)} hashtag, bài kém ${round(bottomHashtags)} hashtag.`,
        action: 'Dùng 2-5 hashtag liên quan trực tiếp, tránh nhồi quá nhiều.',
        evidencePostIds: topGroup.map((post) => post.id).slice(0, 5),
        severity: 'low',
      },
    });
  }

  const topEmoji = median(topFeatures.map((feature) => feature.emojiCount));
  const bottomEmoji = median(bottomFeatures.map((feature) => feature.emojiCount));

  if (topEmoji >= 1 && topEmoji <= 5 && (bottomEmoji < 1 || bottomEmoji > 8)) {
    candidates.push({
      weight: 0.35,
      insight: {
        id: 'emoji',
        label: 'Dùng emoji vừa phải',
        explanation: `Bài top dùng trung bình ${round(topEmoji)} emoji, bài kém ${round(bottomEmoji)} emoji.`,
        action: 'Dùng 2-4 emoji phù hợp ngữ cảnh, không lạm dụng.',
        evidencePostIds: topGroup.map((post) => post.id).slice(0, 5),
        severity: 'low',
      },
    });
  }

  const topSentenceLength = median(topFeatures.map((feature) => feature.avgSentenceWords));
  const bottomSentenceLength = median(
    bottomFeatures.map((feature) => feature.avgSentenceWords)
  );

  if (topSentenceLength <= 20 && bottomSentenceLength >= 25) {
    candidates.push({
      weight: 0.3,
      insight: {
        id: 'sentence_length',
        label: 'Câu ngắn, dễ đọc',
        explanation: `Câu ở bài top dài trung bình ${round(topSentenceLength)} từ, bài kém ${round(bottomSentenceLength)} từ.`,
        action: 'Viết câu ngắn 10-18 từ, tránh câu dài nhiều mệnh đề.',
        evidencePostIds: topGroup.map((post) => post.id).slice(0, 5),
        severity: 'low',
      },
    });
  }

  const topUppercase = median(topFeatures.map((feature) => feature.uppercaseRatio));
  const bottomUppercase = median(bottomFeatures.map((feature) => feature.uppercaseRatio));

  if (bottomUppercase - topUppercase >= 0.15) {
    candidates.push({
      weight: bottomUppercase - topUppercase,
      insight: {
        id: 'uppercase',
        label: 'Tránh viết hoa toàn câu',
        explanation: `Tỷ lệ chữ in hoa ở bài kém là ${round(bottomUppercase * 100)}%, bài top ${round(topUppercase * 100)}%.`,
        action: 'Tránh viết hoa toàn câu; chỉ viết hoa từ cần nhấn mạnh.',
        evidencePostIds: topGroup.map((post) => post.id).slice(0, 5),
        severity: 'low',
      },
    });
  }

  return candidates.filter((candidate): candidate is InsightCandidate => candidate !== null);
};

const WRITING_STYLE_PHRASES: Record<string, string> = {
  hook_question: 'Mở bài bằng câu hỏi',
  cta: 'Kết bằng CTA cụ thể',
  media: 'Luôn có ảnh/video',
  bullet: 'Dùng gạch đầu dòng khi cần',
  first_person: 'Xưng hô gần gũi (mình/bạn)',
  external_link: 'Hạn chế link ngoài',
  length_longer: 'Viết đủ ý',
  length_shorter: 'Viết ngắn gọn',
  paragraphs: 'Chia 3-5 đoạn ngắn',
  hashtags: 'Dùng 2-5 hashtag',
  emoji: 'Dùng 2-4 emoji',
  sentence_length: 'Câu ngắn 10-18 từ',
  uppercase: 'Không viết hoa toàn câu',
};

const buildWritingStyle = (insights: BrandVoiceLesson[]): string => {
  const phrases = insights
    .map((insight) => WRITING_STYLE_PHRASES[insight.id])
    .filter((phrase): phrase is string => Boolean(phrase));

  const parts: string[] = [];

  for (const phrase of phrases) {
    const next = [...parts, phrase].join('; ');
    if (next.length > MAX_WRITING_STYLE_LENGTH) break;
    parts.push(phrase);
  }

  return parts.length > 0 ? `${parts.join('; ')}.` : '';
};

const extractHashtags = (text: string): string[] => {
  const matches = text.match(HASHTAG_PATTERN) ?? [];
  return [...new Set(matches.map((tag) => tag.trim()).filter(Boolean))];
};

const countHashtags = (
  posts: InsightPost[]
): Map<string, { tag: string; count: number }> => {
  const counts = new Map<string, { tag: string; count: number }>();

  for (const post of posts) {
    for (const tag of extractHashtags(post.text)) {
      const key = tag.toLowerCase();
      const existing = counts.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { tag, count: 1 });
      }
    }
  }

  return counts;
};

const extractKeywords = (
  topGroup: InsightPost[],
  bottomGroup: InsightPost[]
): { shouldUse: string[]; avoid: string[] } => {
  const topCounts = countHashtags(topGroup);
  const bottomCounts = countHashtags(bottomGroup);

  const shouldUse = [...topCounts.entries()]
    .filter(([key, value]) => value.count >= 2 && !bottomCounts.has(key))
    .sort((a, b) => b[1].count - a[1].count || a[1].tag.localeCompare(b[1].tag))
    .slice(0, MAX_KEYWORDS)
    .map(([, value]) => value.tag);

  const avoid = [...bottomCounts.entries()]
    .filter(([key, value]) => value.count >= 2 && !topCounts.has(key))
    .sort((a, b) => b[1].count - a[1].count || a[1].tag.localeCompare(b[1].tag))
    .slice(0, MAX_KEYWORDS)
    .map(([, value]) => value.tag);

  return { shouldUse, avoid };
};

export const buildBrandVoiceInsights = ({
  posts,
  limit,
  windowDays,
}: {
  posts: InsightPost[];
  limit: number;
  windowDays: number;
}): BrandVoiceInsights => {
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const deduped = dedupePosts(posts);
  const ranked = deduped.slice(0, safeLimit).map((post, index) => ({
    ...post,
    totalInteractions: totalInteractions(post),
    rank: index + 1,
    signals: buildSignals(post, extractFeatures(post.text)),
  }));

  const sampleSize = deduped.length;
  const usedFallback = sampleSize < BRAND_VOICE_INSIGHT_MIN_POSTS;
  let insights: BrandVoiceLesson[] = [];
  let keywords: { shouldUse: string[]; avoid: string[] } = { shouldUse: [], avoid: [] };

  if (!usedFallback) {
    const groupSize = Math.min(
      MAX_GROUP_SIZE,
      Math.max(MIN_GROUP_SIZE, Math.floor(sampleSize * 0.3))
    );
    const topGroup = deduped.slice(0, groupSize);
    const bottomGroup = deduped.slice(-groupSize);

    insights = buildInsightCandidates(topGroup, bottomGroup)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_INSIGHTS)
      .map((candidate) => candidate.insight);
    keywords = extractKeywords(topGroup, bottomGroup);
  }

  return {
    topPosts: ranked,
    insights,
    suggestedBrandVoice: {
      writingStyle: buildWritingStyle(insights),
      keywordsShouldUse: keywords.shouldUse,
      keywordsAvoid: keywords.avoid,
      fewShotExamples: ranked.slice(0, MAX_EXAMPLES).map((post) => ({
        title: post.title,
        content: post.text.slice(0, MAX_EXAMPLE_LENGTH),
      })),
    },
    meta: {
      sampleSize,
      windowDays,
      minPostsForInsights: BRAND_VOICE_INSIGHT_MIN_POSTS,
      usedFallback,
    },
  };
};

export default { buildBrandVoiceInsights, BRAND_VOICE_INSIGHT_MIN_POSTS };

