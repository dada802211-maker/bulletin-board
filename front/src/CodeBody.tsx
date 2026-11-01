import { useEffect, useMemo, useRef, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import { splitCodeBlocks } from './codeBlocks'
import './CodeBody.css'

// 使用する文法だけ登録し、全言語を読み込むことによる配布サイズの増加を避ける。
hljs.registerLanguage('typescript', typescript)

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [status, setStatus] = useState('')
  const [copying, setCopying] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeRef = useRef<HTMLElement>(null)
  const supported = ['typescript', 'ts', 'javascript', 'js'].includes(language.toLowerCase())
  const highlighted = useMemo(() => supported ? hljs.highlight(code, { language: 'typescript', ignoreIllegals: true }).value : null, [code, supported])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function copy() {
    if (copying) return
    setCopying(true)
    if (timer.current) clearTimeout(timer.current)
    try {
      // HTTPSとlocalhostではClipboard APIを利用する。コピーするのは装飾前の本文だけ。
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(code)
      setStatus('コピーしました')
    } catch {
      // HTTP環境では従来方式を試す。失敗時は選択状態にして手動コピーを案内する。
      const previousFocus = document.activeElement
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.className = 'clipboard-fallback'
      textarea.readOnly = true
      document.body.appendChild(textarea)
      let copied = false
      try { textarea.select(); copied = document.execCommand('copy') }
      catch { /* 未対応ブラウザでは下の手動コピー案内へ進む。 */ }
      finally { textarea.remove(); if (previousFocus instanceof HTMLElement) previousFocus.focus() }
      if (copied) {
        setStatus('コピーしました')
        timer.current = setTimeout(() => setStatus(''), 8000)
        return
      }
      const selection = window.getSelection()
      if (codeRef.current && selection) {
        const range = document.createRange()
        range.selectNodeContents(codeRef.current)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      setStatus('コピーできませんでした。コードを選択し、Ctrl+C（Macは⌘C）でコピーしてください。')
    } finally { setCopying(false) }
    timer.current = setTimeout(() => setStatus(''), 8000)
  }

  return <div className="code-block">
    <div className="code-toolbar"><span>{language || 'コード'}</span><button type="button" disabled={copying} onClick={copy} aria-label="コードをコピー">{status === 'コピーしました' ? 'コピーしました ✓' : 'コピー'}</button></div>
    <pre tabIndex={0} aria-label={`${language || 'プレーンテキスト'}のコード`}>
      {/* highlight.jsが文字をエスケープして生成したHTMLのみ使用し、生の投稿HTMLは渡さない。 */}
      {highlighted !== null ? <code ref={codeRef} dangerouslySetInnerHTML={{ __html: highlighted }}/>: <code ref={codeRef}>{code}</code>}
    </pre>
    <span className="copy-status" role="status">{status}</span>
  </div>
}

export default function CodeBody({ text }: { text: string }) {
  return <div className="formatted-body">{splitCodeBlocks(text).map((block, index) => block.kind === 'code'
    ? <CodeBlock key={`${index}:${block.language}:${block.text}`} code={block.text} language={block.language}/>
    : <p className="post-body" key={index}>{block.text}</p>)}</div>
}

export function CodeHint() {
  return <small className="code-hint">コードは行頭の <code>```typescript</code> と、最後の行の <code>```</code> で囲んでください。Tabでタブ文字を挿入、Shift+Tabで前の項目へ移動できます。</small>
}
