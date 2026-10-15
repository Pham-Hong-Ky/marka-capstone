import { describe, it, expect } from 'vitest';
import swaggerSpec from './swagger.js';

describe('Swagger spec', () => {
  it('đăng ký luồng duyệt bài UC11/UC14', () => {
    expect(swaggerSpec.paths).toHaveProperty('/workspaces/{workspaceId}/posts/{postId}/submit');
    expect(swaggerSpec.paths).toHaveProperty('/workspaces/{workspaceId}/posts/{postId}/review');
  });

  it('đăng ký upload logo workspace', () => {
    expect(swaggerSpec.paths).toHaveProperty('/workspaces/{workspaceId}/logo');
  });
});
