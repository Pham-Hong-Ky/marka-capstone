import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe('Kiểm thử Module Health (Readiness Probe)', () => {
  it('GET /api/v1/health - Trả về mã HTTP tương ứng và thông tin chẩn đoán kết nối', async () => {
    const res = await request(app).get('/api/v1/health');

    expect([200, 503]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe('Hệ thống Marka đang hoạt động ổn định');
      expect(res.body.data.database).toBe('connected');
      expect(res.body.data.redis).toBe('connected');
    } else {
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('error');
    }

    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('redis');
    expect(res.body.data).toHaveProperty('version');
  });
});
