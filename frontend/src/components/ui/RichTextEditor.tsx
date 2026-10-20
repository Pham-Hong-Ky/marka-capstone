import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import {
  Bold,
  Code,
  Ellipsis,
  Eraser,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  SquareCode,
  Sticker,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Underline,
  Undo2,
} from 'lucide-react';
import Modal from './Modal';
import TextField from './TextField';
import Button from './Button';
import EmojiPicker from './EmojiPicker';
import { cn } from '@/utils/cn';

const DEFAULT_CONTENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

type Panel = 'color' | 'highlight' | 'emoji' | 'more';

const TEXT_COLORS: Array<{ name: string; value: string | null }> = [
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

const HIGHLIGHT_COLORS: Array<{ name: string; value: string | null }> = [
  { name: 'Không tô', value: null },
  { name: 'Vàng', value: '#fef08a' },
  { name: 'Xanh lá', value: '#bbf7d0' },
  { name: 'Xanh dương', value: '#bfdbfe' },
  { name: 'Đỏ', value: '#fecaca' },
  { name: 'Tím', value: '#e9d5ff' },
  { name: 'Cam', value: '#fed7aa' },
  { name: 'Xám', value: '#e2e8f0' },
];

const ToolbarButton = ({
  label,
  active = false,
  disabled = false,
  expanded,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    aria-expanded={expanded}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40',
      active && 'bg-accent/10 text-accent-text'
    )}
  >
    {children}
  </button>
);

const PanelAction = ({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      'flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition hover:bg-surface-2',
      active && 'border-accent/60 text-accent-text'
    )}
  >
    {children}
    <span>{label}</span>
  </button>
);

const Separator = () => <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />;

export const RichTextEditor = ({
  value,
  onChange,
  editable = true,
  error,
  ariaLabel = 'Nội dung',
  className,
}: {
  value?: JSONContent;
  onChange?: (json: JSONContent) => void;
  editable?: boolean;
  error?: string;
  ariaLabel?: string;
  className?: string;
}) => {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value ?? DEFAULT_CONTENT,
    editable,
    onUpdate: ({ editor: instance }) => onChange?.(instance.getJSON()),
    editorProps: {
      attributes: {
        class: `marka-editor${editable ? ' marka-editor--editable' : ''}`,
        'aria-label': ariaLabel,
      },
    },
  });

  useEffect(() => {
    if (!panel) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setPanel(null);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [panel]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      block: instance.isActive('heading', { level: 1 })
        ? '1'
        : instance.isActive('heading', { level: 2 })
          ? '2'
          : instance.isActive('heading', { level: 3 })
            ? '3'
            : 'p',
      bold: instance.isActive('bold'),
      italic: instance.isActive('italic'),
      underline: instance.isActive('underline'),
      strike: instance.isActive('strike'),
      code: instance.isActive('code'),
      bulletList: instance.isActive('bulletList'),
      orderedList: instance.isActive('orderedList'),
      blockquote: instance.isActive('blockquote'),
      codeBlock: instance.isActive('codeBlock'),
      link: instance.isActive('link'),
      alignStart: instance.isActive({ textAlign: 'left' }),
      alignCenter: instance.isActive({ textAlign: 'center' }),
      alignEnd: instance.isActive({ textAlign: 'right' }),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const togglePanel = (next: Panel) => setPanel((current) => (current === next ? null : next));

  const applyBlock = (block: string) => {
    if (block === 'p') {
      chain().setParagraph().run();
      return;
    }
    chain().toggleHeading({ level: Number(block) as 1 | 2 | 3 }).run();
  };

  const applyColor = (value: string | null) => {
    if (value) chain().setColor(value).run();
    else chain().unsetColor().run();
    setPanel(null);
  };

  const applyHighlight = (value: string | null) => {
    if (value) chain().setHighlight({ color: value }).run();
    else chain().unsetHighlight().run();
    setPanel(null);
  };

  const applyAlign = (align: 'left' | 'center' | 'right') => {
    chain().setTextAlign(align).run();
    setPanel(null);
  };

  const insertEmoji = (emoji: string) => chain().insertContent(emoji).run();

  const openLink = () => {
    setPanel(null);
    setLinkValue((editor.getAttributes('link').href as string | undefined) ?? '');
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkValue.trim();
    if (url === '') chain().extendMarkRange('link').unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    chain().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div
      className={cn(
        editable && cn('rounded-lg border bg-surface', error ? 'border-danger' : 'border-border'),
        !editable && 'text-sm text-foreground',
        className
      )}
    >
      {editable ? (
        <div ref={toolbarRef} className="relative border-b border-border">
          <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto p-1.5">
            <ToolbarButton
              label="Hoàn tác"
              disabled={!state.canUndo}
              onClick={() => chain().undo().run()}
            >
              <Undo2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Làm lại" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
              <Redo2 className="h-4 w-4" />
            </ToolbarButton>

            <Separator />

            <select
              aria-label="Kiểu đoạn"
              value={state.block}
              onChange={(event) => applyBlock(event.target.value)}
              className="h-11 shrink-0 rounded-md border border-border bg-surface px-2 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="p">Đoạn văn</option>
              <option value="1">Tiêu đề 1</option>
              <option value="2">Tiêu đề 2</option>
              <option value="3">Tiêu đề 3</option>
            </select>

            <ToolbarButton label="Đậm" active={state.bold} onClick={() => chain().toggleBold().run()}>
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Nghiêng"
              active={state.italic}
              onClick={() => chain().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Gạch dưới"
              active={state.underline}
              onClick={() => chain().toggleUnderline().run()}
            >
              <Underline className="h-4 w-4" />
            </ToolbarButton>

            <Separator />

            <ToolbarButton
              label="Danh sách"
              active={state.bulletList}
              onClick={() => chain().toggleBulletList().run()}
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Danh sách số"
              active={state.orderedList}
              onClick={() => chain().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>

            <Separator />

            <ToolbarButton
              label="Màu chữ"
              active={panel === 'color'}
              expanded={panel === 'color'}
              onClick={() => togglePanel('color')}
            >
              <Palette className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Tô nền"
              active={panel === 'highlight'}
              expanded={panel === 'highlight'}
              onClick={() => togglePanel('highlight')}
            >
              <Highlighter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Liên kết" active={state.link} onClick={openLink}>
              <Link2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Chèn icon"
              active={panel === 'emoji'}
              expanded={panel === 'emoji'}
              onClick={() => togglePanel('emoji')}
            >
              <Sticker className="h-4 w-4" />
            </ToolbarButton>

            <Separator />

            <ToolbarButton
              label="Thêm chức năng"
              active={panel === 'more'}
              expanded={panel === 'more'}
              onClick={() => togglePanel('more')}
            >
              <Ellipsis className="h-4 w-4" />
            </ToolbarButton>
          </div>

          {panel === 'color' ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border p-2">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  aria-label={color.name}
                  title={color.name}
                  onClick={() => applyColor(color.value)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface transition hover:bg-surface-2"
                >
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-xs font-semibold"
                    style={color.value ? { backgroundColor: color.value, color: '#ffffff' } : undefined}
                  >
                    A
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {panel === 'highlight' ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border p-2">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  aria-label={color.name}
                  title={color.name}
                  onClick={() => applyHighlight(color.value)}
                  className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface transition hover:bg-surface-2"
                >
                  <span
                    className="h-6 w-6 rounded-full border border-border"
                    style={color.value ? { backgroundColor: color.value } : undefined}
                  />
                </button>
              ))}
            </div>
          ) : null}

          {panel === 'more' ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border p-2">
              <PanelAction
                label="Gạch ngang"
                active={state.strike}
                onClick={() => {
                  chain().toggleStrike().run();
                  setPanel(null);
                }}
              >
                <Strikethrough className="h-4 w-4 text-muted" />
              </PanelAction>
              <PanelAction
                label="Mã inline"
                active={state.code}
                onClick={() => {
                  chain().toggleCode().run();
                  setPanel(null);
                }}
              >
                <Code className="h-4 w-4 text-muted" />
              </PanelAction>
              <PanelAction
                label="Khối mã"
                active={state.codeBlock}
                onClick={() => {
                  chain().toggleCodeBlock().run();
                  setPanel(null);
                }}
              >
                <SquareCode className="h-4 w-4 text-muted" />
              </PanelAction>
              <PanelAction
                label="Trích dẫn"
                active={state.blockquote}
                onClick={() => {
                  chain().toggleBlockquote().run();
                  setPanel(null);
                }}
              >
                <Quote className="h-4 w-4 text-muted" />
              </PanelAction>
              <PanelAction
                label="Đường kẻ"
                onClick={() => {
                  chain().setHorizontalRule().run();
                  setPanel(null);
                }}
              >
                <Minus className="h-4 w-4 text-muted" />
              </PanelAction>

              <PanelAction label="Căn trái" active={state.alignStart} onClick={() => applyAlign('left')}>
                <TextAlignStart className="h-4 w-4 text-muted" />
              </PanelAction>
              <PanelAction
                label="Căn giữa"
                active={state.alignCenter}
                onClick={() => applyAlign('center')}
              >
                <TextAlignCenter className="h-4 w-4 text-muted" />
              </PanelAction>
              <PanelAction label="Căn phải" active={state.alignEnd} onClick={() => applyAlign('right')}>
                <TextAlignEnd className="h-4 w-4 text-muted" />
              </PanelAction>

              <PanelAction
                label="Xoá định dạng"
                onClick={() => {
                  chain().unsetAllMarks().clearNodes().run();
                  setPanel(null);
                }}
              >
                <Eraser className="h-4 w-4 text-muted" />
              </PanelAction>
            </div>
          ) : null}

          {panel === 'emoji' ? (
            <EmojiPicker className="absolute right-0 top-full z-30 mt-1" onSelect={insertEmoji} />
          ) : null}
        </div>
      ) : null}

      <EditorContent editor={editor} />

      {editable && error ? <p className="px-4 pb-2 text-xs text-danger">{error}</p> : null}

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Liên kết"
        footer={
          <>
            {state.link ? (
              <Button
                type="button"
                variant="outline"
                className="mr-auto text-danger"
                onClick={removeLink}
              >
                Gỡ liên kết
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={applyLink}>
              Áp dụng
            </Button>
          </>
        }
      >
        <TextField
          label="URL"
          name="url"
          placeholder="https://..."
          value={linkValue}
          onChange={(event) => setLinkValue(event.target.value)}
        />
      </Modal>
    </div>
  );
};

export default RichTextEditor;
