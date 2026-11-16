import { describe, expect, it } from 'vitest';
import {
  buildBrandVoiceInsights,
  type InsightPost,
} from '../../../src/modules/brandvoice/brandvoice.insight.js';

let sequence = 0;

const makePost = (overrides: Partial<InsightPost> = {}): InsightPost => {
  sequence += 1;

  return {
    id: `post-${sequence}`,
    title: `Bài ${sequence}`,
    text: `Nội dung bài viết ${sequence} đủ dài để phân tích giọng điệu thương hiệu.`,
    publishedAt: new Date('2026-10-01T08:00:00+07:00'),
    channelId: 'channel-1',
    channelName: 'Page chính',
    platform: 'FACEBOOK',
    hasMedia: false,
    metrics: { reactions: 10, comments: 2, shares: 1, reach: null, impressions: null },
    ...overrides,
  };
};

const withTotal = (total: number, overrides: Partial<InsightPost> = {}) =>
  makePost({
    metrics: { reactions: total, comments: 0, shares: 0, reach: null, impressions: null },
    ...overrides,
  });

const buildSample = (count: number) =>
  Array.from({ length: count }, (_, index) => withTotal(index + 1));

describe('buildBrandVoiceInsights', () => {
  it('xếp hạng theo tổng tương tác và lấy đúng số bài top', () => {
    const posts = [withTotal(5), withTotal(50), withTotal(20)];

    const result = buildBrandVoiceInsights({ posts, limit: 2, windowDays: 90 });

    expect(result.topPosts.map((post) => post.totalInteractions)).toEqual([50, 20]);
    expect(result.topPosts[0]?.rank).toBe(1);
  });

  it('loại bài trùng nội dung, giữ bài có tương tác cao hơn', () => {
    const text = 'Một chiếc sơ mi trắng đủ cho cả tuần đi làm của bạn.';
    const posts = [withTotal(10, { text }), withTotal(40, { text }), withTotal(5)];

    const result = buildBrandVoiceInsights({ posts, limit: 5, windowDays: 90 });

    expect(result.topPosts).toHaveLength(2);
    expect(result.topPosts[0]?.totalInteractions).toBe(40);
  });

  it('không sinh insight khi mẫu dưới 10 bài', () => {
    const result = buildBrandVoiceInsights({
      posts: buildSample(5),
      limit: 5,
      windowDays: 90,
    });

    expect(result.insights).toEqual([]);
    expect(result.meta.usedFallback).toBe(true);
    expect(result.meta.sampleSize).toBe(5);
  });

  it('phát hiện nhóm top mở bài bằng câu hỏi', () => {
    const top = Array.from({ length: 5 }, (_, index) =>
      withTotal(100 + index, {
        text: `Bạn có biết vì sao làn da mùa hanh lại khô không? Đây là cách xử lý đơn giản ${index}.`,
      })
    );
    const bottom = Array.from({ length: 5 }, (_, index) =>
      withTotal(10 + index, {
        text: `Hôm nay trời đẹp. Chúng tôi giới thiệu sản phẩm mới của thương hiệu ${index}.`,
      })
    );

    const result = buildBrandVoiceInsights({
      posts: [...top, ...bottom],
      limit: 5,
      windowDays: 90,
    });

    expect(result.insights.map((insight) => insight.id)).toContain('hook_question');
    expect(result.insights.map((insight) => insight.id)).not.toContain('cta');
    expect(result.insights[0]?.explanation).toMatch(/bài top/);
  });

  it('phát hiện nhóm top có CTA', () => {
    const top = Array.from({ length: 5 }, (_, index) =>
      withTotal(100 + index, {
        text: `Một chiếc sơ mi trắng đủ cho cả tuần đi làm ${index}. Bình luận ngay để nhận tư vấn nhé!`,
      })
    );
    const bottom = Array.from({ length: 5 }, (_, index) =>
      withTotal(10 + index, {
        text: `Hôm nay trời đẹp. Chúng tôi giới thiệu sản phẩm mới của thương hiệu ${index}.`,
      })
    );

    const result = buildBrandVoiceInsights({
      posts: [...top, ...bottom],
      limit: 5,
      windowDays: 90,
    });

    expect(result.insights.map((insight) => insight.id)).toContain('cta');
  });

  it('gợi ý writingStyle ngắn gọn và đúng 3 bài mẫu', () => {
    const result = buildBrandVoiceInsights({
      posts: buildSample(10),
      limit: 5,
      windowDays: 90,
    });

    expect(result.suggestedBrandVoice.writingStyle.length).toBeLessThanOrEqual(300);
    expect(result.suggestedBrandVoice.fewShotExamples).toHaveLength(3);
    expect(result.suggestedBrandVoice.fewShotExamples[0]?.content.length).toBeGreaterThan(10);
  });

  it('gợi ý hashtag của nhóm top và nhóm kém', () => {
    const top = Array.from({ length: 5 }, (_, index) =>
      withTotal(100 + index, {
        text: `Phong cách thanh lịch cho người đi làm #ThanhLich #ToiGian ${index}.`,
      })
    );
    const bottom = Array.from({ length: 5 }, (_, index) =>
      withTotal(10 + index, {
        text: `Giảm giá sốc cho mọi người #GiamGia #Sale ${index}.`,
      })
    );

    const result = buildBrandVoiceInsights({
      posts: [...top, ...bottom],
      limit: 5,
      windowDays: 90,
    });

    expect(result.suggestedBrandVoice.keywordsShouldUse).toEqual(
      expect.arrayContaining(['#ThanhLich', '#ToiGian'])
    );
    expect(result.suggestedBrandVoice.keywordsAvoid).toEqual(
      expect.arrayContaining(['#GiamGia', '#Sale'])
    );
  });

  it('không lấy hashtag chỉ xuất hiện một lần hoặc lẫn giữa hai nhóm', () => {
    const top = Array.from({ length: 5 }, (_, index) =>
      withTotal(100 + index, {
        text: `Mẹo phối đồ đi làm #ThanhLich ${index}.`,
      })
    );
    const bottom = Array.from({ length: 5 }, (_, index) =>
      withTotal(10 + index, {
        text: `Giảm giá sốc #GiamGia #ThanhLich ${index}.`,
      })
    );

    const result = buildBrandVoiceInsights({
      posts: [...top, ...bottom],
      limit: 5,
      windowDays: 90,
    });

    expect(result.suggestedBrandVoice.keywordsShouldUse).not.toContain('#ThanhLich');
    expect(result.suggestedBrandVoice.keywordsAvoid).not.toContain('#ThanhLich');
  });

  it('gắn tín hiệu dễ đọc cho từng bài top', () => {
    const result = buildBrandVoiceInsights({
      posts: [
        withTotal(100, {
          text: 'Bạn có biết mẹo chọn sơ mi? Bình luận ngay nhé! #ThoiTrang #ToiGian #DiLam',
          hasMedia: true,
        }),
      ],
      limit: 5,
      windowDays: 90,
    });

    expect(result.topPosts[0]?.signals).toEqual(
      expect.arrayContaining(['Mở bằng câu hỏi', 'Có ảnh/video', 'Có CTA'])
    );
  });

  it('trả về rỗng khi chưa có bài nào', () => {
    const result = buildBrandVoiceInsights({ posts: [], limit: 5, windowDays: 90 });

    expect(result.topPosts).toEqual([]);
    expect(result.insights).toEqual([]);
    expect(result.suggestedBrandVoice.fewShotExamples).toEqual([]);
    expect(result.meta.sampleSize).toBe(0);
  });
});
