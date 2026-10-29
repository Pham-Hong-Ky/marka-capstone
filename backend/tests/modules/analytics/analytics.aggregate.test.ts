import { describe, expect, it } from 'vitest';
import {
  buildSeries,
  computeDelta,
  computeSummary,
  resolveRange,
  type MetricRow,
} from '../../../src/modules/analytics/analytics.aggregate.js';

const row = (overrides: Partial<MetricRow> = {}): MetricRow => ({
  publishedAt: new Date('2026-10-20T03:00:00.000Z'),
  reactions: 0,
  comments: 0,
  shares: 0,
  impressions: null,
  reach: null,
  ...overrides,
});

describe('computeSummary', () => {
  it('cộng dồn tương tác và tính tỷ lệ theo impressions khi có dữ liệu', () => {
    const summary = computeSummary([
      row({ reactions: 10, comments: 2, shares: 1, impressions: 1000, reach: 800 }),
      row({ reactions: 5, comments: 1, shares: 0, impressions: 500, reach: 400 }),
    ]);

    expect(summary).toEqual({
      likes: 15,
      comments: 3,
      shares: 1,
      impressions: 1500,
      reach: 1200,
      engagementRate: 1.27,
    });
  });

  it('trả reach bằng null khi chưa kênh nào trả về dữ liệu tiếp cận', () => {
    const summary = computeSummary([
      row({ reactions: 10, impressions: 1000 }),
      row({ reactions: 5, impressions: 500 }),
    ]);

    expect(summary.reach).toBeNull();
  });

  it('dùng reach làm mẫu số khi Facebook không trả impressions', () => {
    const summary = computeSummary([
      row({ reactions: 10, comments: 2, shares: 1, reach: 800 }),
      row({ reactions: 5, comments: 1, shares: 0, reach: 400 }),
    ]);

    expect(summary.impressions).toBeNull();
    expect(summary.engagementRate).toBe(1.58);
  });

  it('trả tỷ lệ null khi không có cả impressions lẫn reach', () => {
    const summary = computeSummary([row({ reactions: 5, comments: 1 })]);

    expect(summary.engagementRate).toBeNull();
    expect(summary.impressions).toBeNull();
  });
});

describe('computeDelta', () => {
  it('tính phần trăm so với kỳ trước', () => {
    expect(computeDelta(15, 10)).toBe(50);
  });

  it('trả null khi kỳ trước bằng 0 hoặc không có dữ liệu', () => {
    expect(computeDelta(15, 0)).toBeNull();
    expect(computeDelta(15, null)).toBeNull();
  });
});

describe('buildSeries', () => {
  it('gom bài theo ngày giờ Việt Nam và lấp ngày trống', () => {
    const series = buildSeries(
      [
        row({ publishedAt: new Date('2026-10-25T16:59:00.000Z'), reach: 100 }),
        row({ publishedAt: new Date('2026-10-25T17:00:00.000Z'), reach: 50, impressions: 60 }),
      ],
      {
        start: new Date('2026-10-23T17:00:00.000Z'),
        end: new Date('2026-10-26T12:00:00.000Z'),
      }
    );

    expect(series.map((point) => point.date)).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(series.map((point) => point.posts)).toEqual([0, 1, 1]);
    expect(series[1].reach).toBe(100);
    expect(series[2].reach).toBe(50);
    expect(series[2].impressions).toBe(60);
  });

  it('cộng dồn tương tác theo ngày trong series', () => {
    const series = buildSeries(
      [
        row({ publishedAt: new Date('2026-10-25T03:00:00.000Z'), reactions: 10, comments: 2, shares: 1 }),
        row({ publishedAt: new Date('2026-10-25T04:00:00.000Z'), reactions: 5, comments: 0, shares: 0 }),
        row({ publishedAt: new Date('2026-10-26T03:00:00.000Z'), reactions: 1, comments: 1, shares: 1 }),
      ],
      {
        start: new Date('2026-10-24T17:00:00.000Z'),
        end: new Date('2026-10-26T12:00:00.000Z'),
      }
    );

    expect(series.map((point) => point.engagement)).toEqual([18, 3]);
  });
});

describe('resolveRange', () => {
  const now = new Date('2026-10-25T03:00:00.000Z');

  it('7 ngày tính từ đầu ngày hôm nay theo giờ Việt Nam', () => {
    const { current, previous } = resolveRange('7d', undefined, undefined, now);

    expect(current.start.toISOString()).toBe('2026-10-18T17:00:00.000Z');
    expect(current.end.toISOString()).toBe(now.toISOString());
    expect(previous.end.getTime()).toBe(current.start.getTime() - 1);
    expect(previous.start.getTime()).toBeLessThan(previous.end.getTime());
  });

  it('tháng này bắt đầu từ mùng 1 giờ Việt Nam', () => {
    const { current } = resolveRange('mtd', undefined, undefined, now);

    expect(current.start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
  });

  it('tháng trước lấy trọn tháng liền trước', () => {
    const { current } = resolveRange('lastMonth', undefined, undefined, now);

    expect(current.start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(current.end.toISOString()).toBe('2026-09-30T16:59:59.999Z');
  });

  it('khoảng tuỳ chọn ôm trọn ngày bắt đầu và kết thúc', () => {
    const { current } = resolveRange(
      'custom',
      new Date('2026-10-01T00:00:00+07:00'),
      new Date('2026-10-03T00:00:00+07:00'),
      now
    );

    expect(current.start.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(current.end.toISOString()).toBe('2026-10-03T16:59:59.999Z');
  });

  it('từ chối khoảng tuỳ chọn dài hơn 366 ngày', () => {
    expect(() =>
      resolveRange(
        'custom',
        new Date('2024-01-01T00:00:00+07:00'),
        new Date('2026-10-03T00:00:00+07:00'),
        now
      )
    ).toThrow('Khoảng thời gian tối đa 366 ngày');
  });
});
