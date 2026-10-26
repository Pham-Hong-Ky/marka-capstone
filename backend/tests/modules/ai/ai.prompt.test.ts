import { describe, expect, it } from 'vitest';
import {
  buildImagePrompt,
  buildTextPrompt,
  contentToPlainText,
  parseTextOutput,
  toTiptapDoc,
} from '../../../src/modules/ai/ai.prompt.js';

describe('AI prompt helpers', () => {
  it('parseTextOutput từ chối output thiếu title', () => {
    expect(() => parseTextOutput({ blocks: [{ type: 'paragraph', text: 'Nội dung' }] })).toThrow();
  });

  it('toTiptapDoc chuyển heading, paragraph và bulletList sang Tiptap', () => {
    const doc = toTiptapDoc({
      title: 'Tiêu đề',
      blocks: [
        { type: 'heading', text: 'Mở bài' },
        { type: 'paragraph', text: 'Đoạn mở đầu' },
        { type: 'bulletList', items: ['Ý một', 'Ý hai'] },
        { type: 'paragraph', text: '   ' },
      ],
    });

    expect(doc).toEqual({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Mở bài' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Đoạn mở đầu' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ý một' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ý hai' }] }],
            },
          ],
        },
      ],
    });
  });

  it('contentToPlainText lấy đệ quy text và bỏ khoảng trắng thừa', () => {
    const text = contentToPlainText({
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: '  Tiêu đề  ' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Đoạn văn' }] },
      ],
    });

    expect(text).toBe('Tiêu đề\nĐoạn văn');
  });

  it('buildTextPrompt đưa Brand Voice và yêu cầu thêm vào prompt', () => {
    const prompt = buildTextPrompt({
      topic: 'Ra mắt sản phẩm mùa thu',
      instructions: 'Nhấn mạnh ưu đãi',
      brandVoice: {
        industry: 'Thời trang',
        targetAudience: 'Nữ 22-30',
        writingStyle: 'Thân thiện',
        keywordsShouldUse: ['thanh lịch'],
        keywordsAvoid: ['giảm giá sốc'],
      },
    });

    expect(prompt.systemInstruction).toContain('Thời trang');
    expect(prompt.systemInstruction).toContain('Nữ 22-30');
    expect(prompt.systemInstruction).toContain('thanh lịch');
    expect(prompt.systemInstruction).toContain('giảm giá sốc');
    expect(prompt.userPrompt).toContain('Ra mắt sản phẩm mùa thu');
    expect(prompt.userPrompt).toContain('Nhấn mạnh ưu đãi');
    expect(prompt.responseSchema).toBeTruthy();
  });

  it('buildImagePrompt có tiêu đề, nội dung, Brand Voice và giới hạn 2048 ký tự', () => {
    const prompt = buildImagePrompt({
      title: 'Sản phẩm mới',
      contentText: 'Nội dung rất dài '.repeat(500),
      instructions: 'Phong cách tối giản',
      brandVoice: { industry: 'Thời trang', targetAudience: 'Nữ 22-30' },
    });

    expect(prompt).toContain('Sản phẩm mới');
    expect(prompt).toContain('Thời trang');
    expect(prompt).toContain('Phong cách tối giản');
    expect(prompt.length).toBeLessThanOrEqual(2048);
  });
});
