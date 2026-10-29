const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

export const sanitizeSubject = (value: string): string =>
  value.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);

export default { escapeHtml, sanitizeSubject };
