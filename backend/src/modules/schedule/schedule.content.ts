interface ContentMark {
  type?: string;
  attrs?: { href?: string };
}

interface ContentNode {
  type?: string;
  text?: string;
  content?: ContentNode[];
  marks?: ContentMark[];
}

const renderChildren = (nodes: ContentNode[] = []): string => nodes.map(renderNode).join('');

const renderListItem = (item: ContentNode, prefix: string): string =>
  `${prefix}${renderChildren(item.content).trim()}\n`;

const renderNode = (node: ContentNode): string => {
  switch (node.type) {
    case 'text': {
      const text = node.text ?? '';
      const href = node.marks?.find((mark) => mark.type === 'link')?.attrs?.href;
      return href && !text.includes(href) ? `${text} (${href})` : text;
    }
    case 'hardBreak':
      return '\n';
    case 'horizontalRule':
      return '---\n\n';
    case 'bulletList':
      return node.content?.map((item) => renderListItem(item, '• ')).join('') ?? '';
    case 'orderedList':
      return (
        node.content?.map((item, index) => renderListItem(item, `${index + 1}. `)).join('') ?? ''
      );
    case 'paragraph':
    case 'heading':
    case 'blockquote':
    case 'codeBlock':
      return `${renderChildren(node.content)}\n\n`;
    case 'doc':
    case 'listItem':
      return renderChildren(node.content);
    default:
      return node.content ? renderChildren(node.content) : '';
  }
};

/**
 * Chuyển nội dung Tiptap JSON thành plain text để gửi Facebook.
 * Ảnh không nằm trong content mà được xử lý riêng qua MediaAsset.
 */
export const renderContentToPlainText = (content: unknown): string => {
  if (!content || typeof content !== 'object') return '';

  return renderNode(content as ContentNode)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export default renderContentToPlainText;
