import { describe, expect, it } from 'vitest';
import {
  buildBestTimes,
  buildContentTips,
  shouldPenalizeExternalLinks,
  type BestTimeSlot,
  type DraftPost,
  type SuggestionRow,
} from '../../../src/modules/analytics/analytics.suggestion.js';

const publishedAt = (iso: string) => new Date(iso);

const row = (overrides: Partial<SuggestionRow> = {}): SuggestionRow => ({
  publishedAt: publishedAt('2026-10-20T13:00:00.000Z'),
  reactions: 5,
  comments: 0,
  shares: 0,
  impressions: 100,
  reach: null,
  hasLink: false,
  ...overrides,
});

const draft = (overrides: Partial<DraftPost> = {}): DraftPost => ({
  id: 'post-1',
  title: 'Bài nháp',
  text: 'Một đoạn nội dung đủ dài để không bị cảnh báo quá ngắn, có câu hỏi cho người đọc?',
  hasMedia: true,
  scheduledAt: null,
  updatedAt: publishedAt('2026-10-24T03:00:00.000Z'),
  ...overrides,
});

const dataSlot = (overrides: Partial<BestTimeSlot> = {}): BestTimeSlot => ({
  weekday: 2,
  startHour: 20,
  endHour: 22,
  engagementRate: 5,
  postCount: 3,
  source: 'data',
  ...overrides,
});

describe('buildBestTimes', () => {
  it('gộp bài theo thứ và khung 2 giờ ở múi giờ Việt Nam', () => {
    // 20:00 giờ VN thứ Ba = 13:00 UTC thứ Ba.
    const { slots } = buildBestTimes([row(), row(), row()]);

    expect(slots[0]).toMatchObject({
      weekday: 2,
      startHour: 20,
      endHour: 22,
      postCount: 3,
      source: 'data',
    });
    expect(slots[0].engagementRate).toBe(5);
  });

  it('bỏ qua khung có ít hơn 3 bài và bù bằng khung tham khảo', () => {
    const result = buildBestTimes([row(), row()]);

    expect(result.usedFallback).toBe(true);
    expect(result.sampleSize).toBe(2);
    expect(result.slots).toHaveLength(3);
    expect(result.slots.some((slot) => slot.source === 'benchmark')).toBe(true);
  });

  it('trả toàn bộ khung tham khảo khi chưa có bài nào đo được', () => {
    const result = buildBestTimes([row({ impressions: null, reach: null })]);

    expect(result.sampleSize).toBe(0);
    expect(result.slots.every((slot) => slot.source === 'benchmark')).toBe(true);
  });

  it('xếp hạng theo tỷ lệ tương tác trung bình và chỉ lấy top 3', () => {
    const rows: SuggestionRow[] = [];
    for (const [hour, rate] of [
      ['13', 9],
      ['15', 7],
      ['17', 5],
      ['19', 3],
    ] as const) {
      for (let i = 0; i < 3; i += 1) {
        rows.push(
          row({
            publishedAt: publishedAt(`2026-10-20T${hour}:00:00.000Z`),
            reactions: rate,
            impressions: 100,
          })
        );
      }
    }

    const { slots } = buildBestTimes(rows);

    expect(slots.map((slot) => slot.engagementRate)).toEqual([9, 7, 5]);
  });
});

describe('shouldPenalizeExternalLinks', () => {
  const group = (hasLink: boolean, reactions: number, count = 3) =>
    Array.from({ length: count }, () =>
      row({ hasLink, reactions, impressions: 100 })
    );

  it('bật khi nhóm có link thấp hơn rõ rệt và đủ mẫu', () => {
    expect(shouldPenalizeExternalLinks([...group(false, 5), ...group(true, 2)])).toBe(true);
  });

  it('không bật khi thiếu mẫu ở một nhóm', () => {
    expect(
      shouldPenalizeExternalLinks([...group(false, 5), ...group(true, 2, 2)])
    ).toBe(false);
  });

  it('không bật khi chênh lệch không đáng kể', () => {
    expect(shouldPenalizeExternalLinks([...group(false, 5), ...group(true, 4.5)])).toBe(false);
  });
});

describe('buildContentTips', () => {
  const slots = [dataSlot()];

  it('cảnh báo bài chưa có ảnh ở mức cao', () => {
    const [tip] = buildContentTips([draft({ hasMedia: false })], slots);

    expect(tip).toMatchObject({ rule: 'no_media', severity: 'high', postId: 'post-1' });
  });

  it('cảnh báo caption quá ngắn', () => {
    const tips = buildContentTips([draft({ text: 'Ngắn quá' })], slots);

    expect(tips.map((tip) => tip.rule)).toContain('too_short');
  });

  it('cảnh báo caption quá dài', () => {
    const tips = buildContentTips([draft({ text: 'a'.repeat(1200) })], slots);

    expect(tips.map((tip) => tip.rule)).toContain('too_long');
  });

  it('cảnh báo thiếu lời kêu gọi hành động', () => {
    const text = `${'Nội dung mô tả sản phẩm. '.repeat(10)}`;
    const tips = buildContentTips([draft({ text })], slots);

    expect(tips.map((tip) => tip.rule)).toContain('no_cta');
  });

  it('cảnh báo dùng quá 3 hashtag', () => {
    const tips = buildContentTips(
      [draft({ text: 'Nội dung đủ dài cho bài viết này? #a #b #c #d' })],
      slots
    );

    expect(tips.map((tip) => tip.rule)).toContain('too_many_hashtags');
  });

  it('cảnh báo lên lịch ngoài khung giờ tốt', () => {
    // 09:00 giờ VN = 02:00 UTC.
    const tips = buildContentTips(
      [draft({ scheduledAt: publishedAt('2026-10-27T02:00:00.000Z') })],
      slots
    );

    expect(tips.map((tip) => tip.rule)).toContain('outside_best_time');
  });

  it('không cảnh báo giờ khi chỉ có khung tham khảo', () => {
    const tips = buildContentTips(
      [draft({ scheduledAt: publishedAt('2026-10-27T02:00:00.000Z') })],
      [dataSlot({ source: 'benchmark', weekday: null, engagementRate: null, postCount: 0 })]
    );

    expect(tips.map((tip) => tip.rule)).not.toContain('outside_best_time');
  });

  it('chỉ cảnh báo link ngoài khi dữ liệu Page xác nhận', () => {
    const withLink = draft({ text: `${'Nội dung đủ dài cho bài viết này? '.repeat(3)} https://x.vn` });

    const withoutSignal = buildContentTips([withLink], slots);
    const withSignal = buildContentTips([withLink], slots, { penalizeExternalLinks: true });

    expect(withoutSignal.map((tip) => tip.rule)).not.toContain('external_link');
    expect(withSignal.map((tip) => tip.rule)).toContain('external_link');
  });

  it('trả tối đa 3 gợi ý, ưu tiên mức cao trước', () => {
    const tips = buildContentTips(
      [
        draft({
          id: 'post-2',
          hasMedia: false,
          text: 'Ngắn',
          scheduledAt: publishedAt('2026-10-27T02:00:00.000Z'),
        }),
      ],
      slots
    );

    expect(tips).toHaveLength(3);
    expect(tips[0].severity).toBe('high');
  });

  it('không trả gợi ý cho bài đã đủ tốt', () => {
    const tips = buildContentTips(
      [
        draft({
          text: 'Một đoạn nội dung đủ dài để không bị cảnh báo, có câu hỏi cho người đọc? #marka #bánh',
          scheduledAt: publishedAt('2026-10-27T13:30:00.000Z'),
        }),
      ],
      slots
    );

    expect(tips).toEqual([]);
  });
});
