import BodyTextarea from './BodyTextarea'
import CodeBody, { CodeHint } from './CodeBody'
import { useState } from 'react'
import type { FormEvent } from 'react'

type Comment = { id: number; user_id: number; name: string; body: string; created_at: string }
// API呼び出しと認証状態は親から受け取り、投稿ごとにコメント欄を独立させる。
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
  // 編集中の本文は表示用データと分け、キャンセルで保存前の内容を破棄できるようにする。
  const [editingId, setEditingId] = useState<number|null>(null)
  const [editBody, setEditBody] = useState('')

  // コメント一覧は欄を開いたときと追加・削除後に取得する。
  async function load() {
    setLoading(true)
    try { const result = await api(`comments&post_id=${postId}`); setComments(result.comments) }
    finally { setLoading(false) }
  }
  // 再度開くときも読み直し、他のユーザーが追加したコメントを反映する。
  async function toggle() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true); setError('')
    try { await load() } catch (e) { setError((e as Error).message) }
  }
  // 空白のみの送信と連打を防ぐ。追加成功後は親のコメント件数も再取得する。
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
  // 保存が成功するまで編集内容を保持する。本文だけ更新するため件数は変わらない。
  async function saveEdit(e: FormEvent<HTMLFormElement>, id: number) {
    e.preventDefault()
    if (busy || !editBody.trim()) return
    setBusy(true); setError('')
    try {
      await api('comment_update', { id, body: editBody })
      setComments(current => current.map(c => c.id === id ? { ...c, body: editBody.trim() } : c))
      setEditingId(null); setEditBody('')
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  // 削除前に確認を取り、一覧と親の件数を同期する。
  async function remove(id: number) {
    if (!confirm('このコメントを削除しますか？')) return
    setBusy(true); setError('')
    try { await api('comment_delete', { id }); await load(); await onChange() }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  // 編集・削除ボタンは本人だけに表示する。APIでも同じ権限チェックを必ず行う。
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
          {editingId === c.id && c.user_id === userId ? <form className="comment-form" onSubmit={e => saveEdit(e, c.id)}>
            <label htmlFor={`comment-edit-${c.id}`}>コメントを編集</label>
            <BodyTextarea id={`comment-edit-${c.id}`} autoFocus required rows={3} maxLength={2000} value={editBody} disabled={busy} onValueChange={setEditBody}/>
            <CodeHint/><div className="comment-actions"><small>{editBody.length} / 2000</small><div>
              <button type="button" className="plain" disabled={busy} onClick={() => { setEditingId(null); setEditBody(''); setError('') }}>キャンセル</button>
              <button disabled={busy || !editBody.trim()}>{busy ? '保存中…' : '変更を保存'}</button>
            </div></div>
          </form> : <>
            <CodeBody text={c.body}/>
            {c.user_id === userId && <div>
              <button className="plain" disabled={busy || editingId !== null} onClick={() => { setEditingId(c.id); setEditBody(c.body); setError('') }}>編集</button>
              <button className="delete" disabled={busy || editingId !== null} onClick={() => remove(c.id)}>コメントを削除</button>
            </div>}
          </>}
        </li>)}</ul>
      </>}
      {editingId === null && (userId ? <form className="comment-form" onSubmit={submit}>
        <label htmlFor={`comment-body-${postId}`}>コメントを書く</label>
        <BodyTextarea id={`comment-body-${postId}`} value={body} onValueChange={setBody} maxLength={2000} required rows={3} placeholder="相手を思いやる言葉で、会話に参加しましょう。" disabled={busy}/>
        <CodeHint/><div className="comment-actions"><small>{body.length} / 2000</small><button disabled={busy || !body.trim()}>{busy ? '送信中…' : 'コメントを送信'}</button></div>
      </form> : <button className="plain" onClick={onLogin}>ログインしてコメントする →</button>)}
    </div>}
  </section>
}
