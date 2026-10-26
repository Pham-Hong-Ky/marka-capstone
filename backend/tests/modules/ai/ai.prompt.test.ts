import { describe, expect, it } from 'vitest';
import { AiProviderConfigError } from '../../../src/modules/ai/ai.errors.js';
import {
  buildImageArtPrompt,
  buildImagePrompt,
  parseImageArtOutput,
  parseImageSourcePayload,
  serializeImageSource,
} from '../../../src/modules/ai/ai.image-prompt.js';
import {
  buildTextPrompt,
  contentToPlainText,
  parseTextOutput,
  parseTextPromptPayload,
  serializeTextPrompt,
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

  it('buildTextPrompt nêu cấu trúc, độ dài và luật Brand Voice', () => {
    const prompt = buildTextPrompt({
      topic: 'Ra mắt sản phẩm mùa thu',
      instructions: 'Nhấn mạnh ưu đãi',
      brandVoice: {
        industry: 'Thời trang',
        targetAudience: 'Nữ 22-30',
        writingStyle: 'Thân thiện',
        keywordsShouldUse: ['thanh lịch'],
        keywordsAvoid: ['giảm giá sốc'],
        fewShotExamples: [
          { title: 'Mẫu 1', content: 'Nội dung mẫu một' },
          { title: 'Mẫu 2', content: 'Nội dung mẫu hai' },
        ],
      },
    });

    expect(prompt.systemInstruction).toContain('Facebook');
    expect(prompt.systemInstruction).toContain('250-400 từ');
    expect(prompt.systemInstruction).toContain('CTA');
    expect(prompt.systemInstruction).toContain('Tuyệt đối không dùng: giảm giá sốc');
    expect(prompt.systemInstruction).toContain('Nội dung mẫu một');
    expect(prompt.systemInstruction).toContain('Nội dung mẫu hai');
    expect(prompt.userPrompt).toContain('Ra mắt sản phẩm mùa thu');
    expect(prompt.userPrompt).toContain('Nhấn mạnh ưu đãi');
    expect(prompt.userPrompt).toContain('Viết bài hoàn chỉnh');
    expect(prompt.responseSchema).toBeTruthy();
  });

  it('buildTextPrompt bắt buộc tiếng Việt có dấu, emoji và hashtag cuối bài', () => {
    const prompt = buildTextPrompt({ topic: 'Gioi thieu dia diem du lich o ha noi' });

    expect(prompt.systemInstruction).toContain('có dấu đầy đủ');
    expect(prompt.systemInstruction).toContain('không dấu');
    expect(prompt.systemInstruction).toContain('emoji');
    expect(prompt.systemInstruction).toContain('3-5 hashtag');
    expect(prompt.userPrompt).toContain('tiếng Việt có dấu đầy đủ');
  });

  it('buildTextPrompt cấm biến cả bài thành danh sách', () => {
    const prompt = buildTextPrompt({ topic: 'Ra mắt bộ sưu tập mùa thu' });

    expect(prompt.systemInstruction).toContain('ít nhất 2 đoạn văn');
    expect(prompt.systemInstruction).toContain('không được biến cả bài thành danh sách');
  });

  it('parseTextOutput từ chối block thiếu nội dung theo loại', () => {
    expect(() =>
      parseTextOutput({ title: 'Tiêu đề', blocks: [{ type: 'paragraph' }] })
    ).toThrow();
    expect(() =>
      parseTextOutput({ title: 'Tiêu đề', blocks: [{ type: 'bulletList', items: [] }] })
    ).toThrow();
  });

  it('buildImageArtPrompt yêu cầu prompt ảnh tiếng Anh, không chữ hay logo', () => {
    const art = buildImageArtPrompt({
      title: 'Sản phẩm mới',
      contentText: 'Chất liệu len mềm',
      instructions: 'Phong cách tối giản',
      brandVoice: { industry: 'Thời trang' },
    });

    expect(art.systemInstruction).toContain('English');
    expect(art.systemInstruction).toContain('no text');
    expect(art.userPrompt).toContain('Sản phẩm mới');
    expect(art.userPrompt).toContain('Phong cách tối giản');
    expect(art.userPrompt).toContain('Thời trang');
    expect(art.responseSchema).toBeTruthy();
  });

  it('parseImageArtOutput trả prompt đã trim và từ chối output rỗng', () => {
    expect(parseImageArtOutput({ prompt: '  a calm autumn fashion flat lay  ' })).toBe(
      'a calm autumn fashion flat lay'
    );
    expect(() => parseImageArtOutput({ prompt: '' })).toThrow();
  });

  it('parseImageArtOutput chấp nhận prompt dài hơn hướng dẫn để job không fail oan', () => {
    const long = 'a calm autumn fashion flat lay with warm tones '.repeat(20);

    expect(parseImageArtOutput({ prompt: long })).toBe(long.trim());
  });

  it('buildImageArtPrompt neo bối cảnh Việt Nam, tránh chi tiết Trung/Nhật/Hàn', () => {
    const art = buildImageArtPrompt({
      title: 'Áo phông trẻ em',
      contentText: 'Áo cotton thoáng mát cho bé',
    });

    expect(art.systemInstruction).toContain('contemporary Vietnam');
    expect(art.systemInstruction).toContain('product-focused');
    expect(art.systemInstruction).toContain('hanfu');
    expect(art.userPrompt).toContain('Market: Vietnam');
  });

  it('buildImagePrompt giữ ràng buộc văn hoá Việt Nam khi gửi FLUX', () => {
    const prompt = buildImagePrompt('a child wearing a colorful t-shirt in a park');

    expect(prompt).toContain('Vietnamese');
    expect(prompt).toContain('No text');
  });

  it('buildImagePrompt luôn giữ ràng buộc không chữ/logo khi prompt dài', () => {
    const prompt = buildImagePrompt('autumn fashion flat lay '.repeat(300));

    expect(prompt.length).toBeLessThanOrEqual(2048);
    expect(prompt).toContain('No text');
  });

  it('serialize/parse text prompt payload giữ nguyên nội dung', () => {
    const payload = { systemInstruction: 'system', userPrompt: 'user' };

    expect(parseTextPromptPayload(serializeTextPrompt(payload))).toEqual(payload);
  });

  it('parseTextPromptPayload từ chối JSON hỏng hoặc thiếu field', () => {
    expect(() => parseTextPromptPayload('không phải json')).toThrow(AiProviderConfigError);
    expect(() =>
      parseTextPromptPayload(JSON.stringify({ systemInstruction: 'system' }))
    ).toThrow(AiProviderConfigError);
  });

  it('parseImageSourcePayload đọc được payload mới và payload cũ chỉ có imagePrompt', () => {
    const source = {
      title: 'Bài viết',
      contentText: 'Nội dung bài viết',
      instructions: null,
      brandVoice: { industry: 'Thời trang' },
    };

    expect(parseImageSourcePayload(serializeImageSource(source))).toMatchObject(source);
    expect(parseImageSourcePayload(JSON.stringify({ imagePrompt: 'legacy prompt' }))).toEqual({
      imagePrompt: 'legacy prompt',
    });
  });

  it('parseImageSourcePayload từ chối dữ liệu không phải object', () => {
    expect(() => parseImageSourcePayload(JSON.stringify(['không phải object']))).toThrow(
      AiProviderConfigError
    );
  });
});
