import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { ChatMessage } from '../online/contracts'
import { useOnline } from '../online/onlineStore'

const QUICK_COMMANDS = ['/集合 迷雾关', '/进攻 望月灵泉', '/防守 苍梧古阵', '/驻防 当前据点', '/跟进', '/收到']

export function ChatPanel() {
  const snapshot = useOnline(x => x.snapshot)
  const loadChat = useOnline(x => x.loadChat)
  const sendChat = useOnline(x => x.sendChat)
  const onlineError = useOnline(x => x.error)
  const [channel, setChannel] = useState<'world' | 'sect'>('world')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [collapsed, setCollapsed] = useState(true)
  const [sending, setSending] = useState(false)

  const visibleMessages = useMemo(() => messages.slice(-60), [messages])

  useEffect(() => {
    let disposed = false
    const pull = async (after?: string) => {
      const next = await loadChat(channel, after)
      if (disposed || next.length === 0) return
      setMessages(current => after ? mergeMessages(current, next) : next)
    }
    setMessages([])
    void pull()
    const timer = window.setInterval(() => void pull(), 1000)
    return () => { disposed = true; window.clearInterval(timer) }
  }, [channel, loadChat])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const next = await sendChat(channel, text)
    if (next.length > 0) setMessages(current => mergeMessages(current, next))
    setDraft('')
    setSending(false)
  }

  const chooseQuick = (text: string) => {
    setDraft(text)
    setCollapsed(false)
  }

  return <section className={'warfront-chat' + (collapsed ? ' collapsed' : '')}>
    <div className="warfront-chat-head">
      <div className="warfront-chat-title"><span className="online-dot" /><b>实时指挥频道</b><small>{snapshot?.player.sectName ?? '宗门'} · 服务器同步</small></div>
      <div className="warfront-chat-actions"><button className={'chat-tab' + (channel === 'world' ? ' on' : '')} type="button" onClick={() => setChannel('world')}>全服</button><button className={'chat-tab' + (channel === 'sect' ? ' on' : '')} type="button" onClick={() => setChannel('sect')}>宗门</button><button className="chat-collapse" type="button" onClick={() => setCollapsed(value => !value)}>{collapsed ? '展开' : '收起'}</button></div>
    </div>
    {!collapsed && <>
      <div className="warfront-chat-quick">{QUICK_COMMANDS.map(command => <button key={command} type="button" onClick={() => chooseQuick(command)}>{command}</button>)}</div>
      <div className="warfront-chat-list" aria-live="polite">{visibleMessages.length === 0 ? <div className="chat-empty">还没有消息，发出第一条战区指令。</div> : visibleMessages.map(message => <div className={'chat-message' + (message.senderId === snapshot?.player.id ? ' mine' : '')} key={message.id}><div><b>{message.senderName}</b><small>{message.sectName} · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div><p className={message.command ? 'command' : ''}>{message.text}</p></div>)}</div>
      <form className="warfront-chat-compose" onSubmit={submit}><input value={draft} maxLength={120} onChange={event => setDraft(event.target.value)} placeholder={channel === 'sect' ? '对宗门下达指令…' : '向全服修士发言…'} /><button className="btn-sub" disabled={sending || !draft.trim()}>{sending ? '发送中' : '发送'}</button></form>
      {onlineError && <div className="chat-error">{onlineError}</div>}
    </>}
    {!collapsed && <span className="chat-sync-mark">已同步</span>}
  </section>
}

function mergeMessages(current: ChatMessage[], next: ChatMessage[]): ChatMessage[] {
  const map = new Map(current.map(message => [message.id, message]))
  next.forEach(message => map.set(message.id, message))
  return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt).slice(-60)
}
