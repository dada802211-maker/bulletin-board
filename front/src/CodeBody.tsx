import LinkedText from './LinkedText'
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
    : <p className="post-body" key={index}><LinkedText text={block.text}/></p>)}</div>
}

export function CodeHint() {
  // 投稿・コメントの作成と編集で同じ説明を表示する。入力中でも折りたたんで参照できる。
  return <details className="code-help">
    <summary>コードの入力方法・サンプルを見る</summary>
    <div className="code-help-content">
      <p>コードの前後をバッククォート3個（<code>```</code>）で囲みます。開始行には言語名を付け、開始・終了の記号はそれぞれ行頭に書いてください。</p>
      <h4>TypeScriptの入力例</h4>
      <pre tabIndex={0} aria-label="TypeScriptの入力例"><code>{'```typescript\nconst message: string = \'こんにちは\';\n\nfunction greet(): void {\n\tconsole.log(message);\n}\n```'}</code></pre>
      <p><code>ts</code> と書いても構文が色分けされます。コードの前後に通常の説明文を入れたり、複数のコードを載せたりできます。</p>
      <h4>PHPの入力例</h4>
      <pre tabIndex={0} aria-label="PHPの入力例"><code>{'```php\n<?php\n$message = \'こんにちは\';\necho $message;\n```'}</code></pre>
      <p>PHPはコード枠・インデント保持・コピーに対応しています。現在、PHPの構文色分けには対応していません。</p>
      <ul>
        <li><kbd>Tab</kbd>：タブ文字を挿入します（表示は4文字幅）。選択中の文字がある場合は、その範囲をタブ1文字に置き換えます。</li>
        <li><kbd>Shift</kbd>＋<kbd>Tab</kbd>：前の入力項目へ移動します。</li>
        <li>投稿後はコード枠の「コピー」からコード本文をコピーできます。失敗した場合は、コードを選択して <kbd>Ctrl</kbd>＋<kbd>C</kbd>（Macは <kbd>⌘</kbd>＋<kbd>C</kbd>）でコピーしてください。</li>
        <li>終了行の <code>```</code> を忘れると、コード枠にならず原文のまま表示されます。</li>
        <li>囲み記号や説明文も含め、投稿本文は5,000文字、コメントは2,000文字までです。</li>
      </ul>
      <p>本文中の https:// または http:// で始まるURLはリンクになり、別タブで開きます。コード枠内のURLはリンクになりません。</p><p className="code-help-note">コードは表示のみで、実行されません。</p>
    </div>
  </details>
}
