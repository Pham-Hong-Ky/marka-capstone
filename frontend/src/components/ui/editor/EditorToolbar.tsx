import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
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
import EmojiPicker from '@/components/ui/EmojiPicker';
import { cn } from '@/utils/cn';
import {
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  type EditorBlock,
  type EditorPanel,
  type EditorToolbarState,
} from './editor.constants';

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

export const EditorToolbar = ({
  editor,
  state,
  onOpenLink,
}: {
  editor: Editor;
  state: EditorToolbarState;
  onOpenLink: () => void;
}) => {
  const [panel, setPanel] = useState<EditorPanel | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

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

  const chain = () => editor.chain().focus();
  const togglePanel = (next: EditorPanel) => setPanel((current) => (current === next ? null : next));

  const applyBlock = (block: EditorBlock) => {
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
    onOpenLink();
  };

  return (
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
          onChange={(event) => applyBlock(event.target.value as EditorBlock)}
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
  );
};

export default EditorToolbar;
