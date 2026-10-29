export type EditorPanel = 'color' | 'highlight' | 'emoji' | 'more';

export type EditorBlock = 'p' | '1' | '2' | '3';

export interface EditorToolbarState {
  block: EditorBlock;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  code: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  codeBlock: boolean;
  link: boolean;
  alignStart: boolean;
  alignCenter: boolean;
  alignEnd: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export const TEXT_COLORS: Array<{ name: string; value: string | null }> = [
  { name: 'Mặc định', value: null },
  { name: 'Xám', value: '#64748b' },
  { name: 'Đỏ', value: '#dc2626' },
  { name: 'Cam', value: '#ea580c' },
  { name: 'Vàng', value: '#ca8a04' },
  { name: 'Xanh lá', value: '#16a34a' },
  { name: 'Ngọc', value: '#0d9488' },
  { name: 'Xanh dương', value: '#2563eb' },
  { name: 'Tím', value: '#7c3aed' },
  { name: 'Hồng', value: '#db2777' },
];

export const HIGHLIGHT_COLORS: Array<{ name: string; value: string | null }> = [
  { name: 'Không tô', value: null },
  { name: 'Vàng', value: '#fef08a' },
  { name: 'Xanh lá', value: '#bbf7d0' },
  { name: 'Xanh dương', value: '#bfdbfe' },
  { name: 'Đỏ', value: '#fecaca' },
  { name: 'Tím', value: '#e9d5ff' },
  { name: 'Cam', value: '#fed7aa' },
  { name: 'Xám', value: '#e2e8f0' },
];
