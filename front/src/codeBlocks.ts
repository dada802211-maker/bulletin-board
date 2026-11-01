export type BodyBlock = { kind: 'text'; text: string } | { kind: 'code'; text: string; language: string }

// 行単位のフェンスだけを解釈する。通常の文章・HTMLはMarkdownとして解釈しない。
// コード内部のスペース、タブ、改行は元の文字列から切り出して保持する。
export function splitCodeBlocks(text: string): BodyBlock[] {
  const blocks: BodyBlock[] = []
  const opening = /^(`{3,})([\w+-]*)[^\S\r\n]*\r?\n/gm
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = opening.exec(text)) !== null) {
    const start = opening.lastIndex
    const closing = new RegExp('^`{' + match[1].length + ',}[^\\S\\r\\n]*(?:\\r?\\n|$)', 'gm')
    closing.lastIndex = start
    const end = closing.exec(text)
    // 閉じ忘れたブロックは原文のまま表示し、本文を消してしまわない。
    if (!end) break
    if (match.index > cursor) blocks.push({ kind: 'text', text: text.slice(cursor, match.index) })
    blocks.push({ kind: 'code', text: text.slice(start, end.index), language: match[2] })
    cursor = closing.lastIndex
    opening.lastIndex = cursor
  }
  if (cursor < text.length) blocks.push({ kind: 'text', text: text.slice(cursor) })
  return blocks
}
