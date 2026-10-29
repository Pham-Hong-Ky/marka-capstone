import { describe, expect, it } from 'vitest';
import { renderContentToPlainText } from '../../../src/modules/schedule/schedule.content.js';

const doc = (...content: unknown[]) => ({ type: 'doc', content });

describe('renderContentToPlainText', () => {
  it('trả chuỗi rỗng với nội dung không hợp lệ', () => {
    expect(renderContentToPlainText(null)).toBe('');
    expect(renderContentToPlainText('abc')).toBe('');
    expect(renderContentToPlainText({})).toBe('');
  });

  it('nối các paragraph và giữ dòng trống giữa các block', () => {
    expect(
      renderContentToPlainText(
        doc(
          { type: 'heading', content: [{ type: 'text', text: 'Tiêu đề' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Nội dung chính' }] }
        )
      )
    ).toBe('Tiêu đề\n\nNội dung chính');
  });

  it('giữ hard break thành xuống dòng', () => {
    expect(
      renderContentToPlainText(
        doc({
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Dòng 1' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Dòng 2' },
          ],
        })
      )
    ).toBe('Dòng 1\nDòng 2');
  });

  it('chuyển bullet list thành ký tự •', () => {
    expect(
      renderContentToPlainText(
        doc({
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Một' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hai' }] }] },
          ],
        })
      )
    ).toBe('• Một\n• Hai');
  });

  it('đánh số ordered list', () => {
    expect(
      renderContentToPlainText(
        doc({
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bước 1' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bước 2' }] }] },
          ],
        })
      )
    ).toBe('1. Bước 1\n2. Bước 2');
  });

  it('giữ href của link nếu text không chứa URL', () => {
    expect(
      renderContentToPlainText(
        doc({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Marka',
              marks: [{ type: 'link', attrs: { href: 'https://marka.vn' } }],
            },
          ],
        })
      )
    ).toBe('Marka (https://marka.vn)');
  });
});
