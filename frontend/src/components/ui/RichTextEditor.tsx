import { useState } from 'react';
import { EditorContent, useEditor, useEditorState, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import EditorToolbar from './editor/EditorToolbar';
import LinkDialog from './editor/LinkDialog';
import type { EditorToolbarState } from './editor/editor.constants';
import { cn } from '@/utils/cn';

const DEFAULT_CONTENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

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
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');

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

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }): EditorToolbarState => ({
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

  const openLink = () => {
    if (!editor) return;
    setLinkValue((editor.getAttributes('link').href as string | undefined) ?? '');
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const url = linkValue.trim();
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
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
      {editable && editor && state ? (
        <EditorToolbar editor={editor} state={state} onOpenLink={openLink} />
      ) : null}

      <EditorContent editor={editor} />

      {editable && error ? <p className="px-4 pb-2 text-xs text-danger">{error}</p> : null}

      {editable ? (
        <LinkDialog
          open={linkOpen}
          value={linkValue}
          hasLink={Boolean(state?.link)}
          onChange={setLinkValue}
          onApply={applyLink}
          onRemove={removeLink}
          onClose={() => setLinkOpen(false)}
        />
      ) : null}
    </div>
  );
};

export default RichTextEditor;
