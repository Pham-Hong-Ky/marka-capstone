interface DocNode {
  text?: string;
  content?: DocNode[];
}

const collectText = (node: DocNode): string => {
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) return node.content.map(collectText).join('');
  return '';
};

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

export const isContentEmpty = (content: unknown): boolean => {
  if (!content || typeof content !== 'object') return true;
  return collectText(content as DocNode).trim().length === 0;
};
