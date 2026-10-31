import { useState } from 'react'
import type { FormEvent } from 'react'

type Comment = { id: number; user_id: number; name: string; body: string; created_at: string }
type Props = {
  postId: number
  count: number
  userId?: number
  api: (action: string, data?: object) => Promise<any>
  onLogin: () => void
  onChange: () => Promise<void>
}

export default function Comments({ postId, count, userId, api, onLogin, onChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { const result = await api(`comments&post_id=${postId}`); setComments(result.comments) }
    finally { setLoading(false) }
  }
  async function toggle() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true); setError('')
    try { await load() } catch (e) { setError((e as Error).message) }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!body.trim() || busy) return
    setBusy(true); setError('')
    try {
      await api('comment_create', { post_id: postId, body })
      setBody('')
      await load(); await onChange()
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  async function remove(id: number) {
    if (!confirm('このコメントを削除しますか？')) return
    setBusy(true); setError('')
    try { await api('comment_delete', { id }); await load(); await onChange() }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="comments" aria-label="コメント">
    <button className="comment-toggle plain" aria-expanded={expanded} aria-controls={`comments-${postId}`} onClick={toggle}>
      コメント {count}件 <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
    </button>
    {expanded && <div id={`comments-${postId}`}>
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p className="muted" role="status">読み込み中…</p> : <>
        {comments.length === 0 && !error && <p className="muted">まだコメントはありません。最初のひとことをどうぞ。</p>}
        <ul className="comment-list">{comments.map(c => <li key={c.id}>
          <div className="comment-heading"><span className="author"><span className="avatar">{c.name.slice(0, 1)}</span>{c.name}</span><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString('ja-JP')}</time></div>
          <p className="post-body">{c.body}</p>
          {c.user_id === userId && <button className="delete" disabled={busy} onClick={() => remove(c.id)}>コメントを削除</button>}
        </li>)}</ul>
      </>}
      {userId ? <form className="comment-form" onSubmit={submit}>
        <label htmlFor={`comment-body-${postId}`}>コメントを書く</label>
        <textarea id={`comment-body-${postId}`} value={body} onChange={e => setBody(e.target.value)} maxLength={2000} required rows={3} placeholder="相手を思いやる言葉で、会話に参加しましょう。" disabled={busy}/>
        <div className="comment-actions"><small>{body.length} / 2000</small><button disabled={busy || !body.trim()}>{busy ? '送信中…' : 'コメントを送信'}</button></div>
      </form> : <button className="plain" onClick={onLogin}>ログインしてコメントする →</button>}
    </div>}
  </section>
}
