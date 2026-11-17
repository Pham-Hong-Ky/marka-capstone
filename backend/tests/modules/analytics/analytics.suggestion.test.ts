import { describe, expect, it } from 'vitest';
import {
  buildBestTimes,
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
