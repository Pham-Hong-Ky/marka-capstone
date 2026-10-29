// Đếm theo ký tự người dùng nhìn thấy: emoji hay chữ có dấu tổ hợp chỉ tính 1, khác `length`.
export const countGraphemes = (text: string): number =>
  [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)].length;

export default { countGraphemes };
