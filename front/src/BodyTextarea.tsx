import { useLayoutEffect, useRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

// 投稿とコメントで共通の本文入力。値とカーソル位置をReactの更新後に揃える。
export default function BodyTextarea({ value, onValueChange, onKeyDown, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const cursor = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (cursor.current !== null) {
      ref.current?.setSelectionRange(cursor.current, cursor.current)
      cursor.current = null
    }
  })

  return <textarea {...props} ref={ref} value={value}
    onChange={e => onValueChange(e.target.value)}
    onKeyDown={e => {
      onKeyDown?.(e)
      // Shift+Tabは通常のフォーカス移動として残し、キーボードだけでも欄を抜けられるようにする。
      if (e.defaultPrevented || e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent.isComposing || props.readOnly || props.disabled) return
      e.preventDefault()
      const { selectionStart, selectionEnd } = e.currentTarget
      const next = value.slice(0, selectionStart) + '\t' + value.slice(selectionEnd)
      // キーボード経由の挿入でも通常入力と同じ文字数制限を守る。
      if (props.maxLength !== undefined && props.maxLength >= 0 && next.length > props.maxLength) return
      cursor.current = selectionStart + 1
      onValueChange(next)
      // 同じ値に置き換えた場合は再描画されないため、現在のDOMにも選択位置を反映する。
      e.currentTarget.setSelectionRange(cursor.current, cursor.current)
    }}/>
}
