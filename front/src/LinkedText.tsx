// 通常の本文にあるHTTP(S) URLだけをリンク化する。HTMLとしては解釈しない。
export default function LinkedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  const urls = /https?:\/\/[^\s<>"'`\u3000-\u303f\uff01-\uff60]+/gi
  let cursor = 0
  for (const match of text.matchAll(urls)) {
    const start = match.index!
    let url = match[0].replace(/[.,!?:;]+$/, '')
    // 説明文側の閉じ括弧は除き、URL内で対応している括弧は保持する。
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1)
    }
    try {
      const parsed = new URL(url)
      if (!parsed.hostname || !['http:', 'https:'].includes(parsed.protocol)) continue
    } catch { continue }
    parts.push(text.slice(cursor, start))
    parts.push(<a key={start} href={url} target="_blank" rel="noopener noreferrer" className="body-link">{url}</a>)
    cursor = start + url.length
  }
  parts.push(text.slice(cursor))
  return <>{parts}</>
}
