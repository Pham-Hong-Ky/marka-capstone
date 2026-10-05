import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import enforceHttps from './enforceHttps.js';

describe('Middleware enforceHttps (Bắt buộc HTTPS ở production)', () => {
  const app = express();
  app.use(enforceHttps);
  app.get('/ping', (_req, res) => res.json({ ok: true }));

  it('Chuyển hướng 301 sang HTTPS khi request là HTTP', async () => {
    const res = await request(app).get('/ping').set('Host', 'api.marka.vn');

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://api.marka.vn/ping');
  });

  it('Cho qua khi reverse proxy báo x-forwarded-proto = https', async () => {
    const res = await request(app).get('/ping').set('x-forwarded-proto', 'https');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
