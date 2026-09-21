import { useCallback, useEffect, useState } from 'react'
import { WARFRONT_NODE_MAP } from '../game/warfront'
import type { OnlinePlayerSearch, WarfrontSnapshot } from '../online/contracts'
import { useOnline } from '../online/onlineStore'
import { fmt } from './util'

interface FriendPanelProps {
  snapshot: WarfrontSnapshot
}

export function FriendPanel({ snapshot }: FriendPanelProps) {
  const searchPlayers = useOnline(state => state.searchPlayers)
  const requestFriend = useOnline(state => state.requestFriend)
  const respondFriend = useOnline(state => state.respondFriend)
  const removeFriend = useOnline(state => state.removeFriend)
  const error = useOnline(state => state.error)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OnlinePlayerSearch[]>([])
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayerSearch[]>([])
  const [workingId, setWorkingId] = useState('')

  const loadOnlinePlayers = useCallback(async () => {
    setOnlinePlayers(await searchPlayers('', true))
  }, [searchPlayers])

  useEffect(() => {
    void loadOnlinePlayers()
  }, [loadOnlinePlayers, snapshot.player.id])

  useEffect(() => {
    const normalized = query.trim()
    if (!normalized) {
      setResults([])
      return undefined
    }
    const timer = window.setTimeout(() => {
      void searchPlayers(normalized).then(setResults)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [query, searchPlayers, snapshot.player.id])

  const incoming = snapshot.friendRequests.filter(request => request.direction === 'incoming')
  const outgoing = snapshot.friendRequests.filter(request => request.direction === 'outgoing')

  const run = async (id: string, action: () => Promise<boolean>) => {
    setWorkingId(id)
    const result = await action()
    setWorkingId('')
    return result
  }

  const handleSearchAction = async (result: OnlinePlayerSearch): Promise<boolean> => {
    if (result.relation === 'incoming' && result.requestId) {
      const accepted = await run(result.id, () => respondFriend(result.requestId!, true))
      if (query.trim()) setResults(await searchPlayers(query.trim()))
      return accepted
    }
    if (result.relation === 'none') {
      const requested = await run(result.id, () => requestFriend(result.id))
      if (query.trim()) setResults(await searchPlayers(query.trim()))
      await loadOnlinePlayers()
      return requested
    }
    return false
  }

  return (
    <section className="friend-panel" aria-label="好友系统">
      <div className="friend-online-head">
        <div><span className="friend-status-dot online" /><b>在线修士 · {onlinePlayers.length}</b><small>可直接发出好友申请</small></div>
        <button className="friend-refresh" type="button" onClick={() => void loadOnlinePlayers()} title="刷新在线修士" aria-label="刷新在线修士">↻</button>
      </div>
      {onlinePlayers.length === 0
        ? <div className="friend-empty">暂时没有其他在线修士。战区打开后会自动刷新在线状态。</div>
        : <div className="friend-online-list">{onlinePlayers.map(result => <SearchResult key={result.id} result={result} working={workingId === result.id} onAction={() => handleSearchAction(result)} />)}</div>}

      <div className="friend-search">
        <input
          aria-label="搜索玩家"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="搜索玩家名称或 ID"
          maxLength={24}
        />
        <span>{query.trim() ? `${results.length} 个结果` : '按名查找'}</span>
      </div>

      {results.length > 0 && <div className="friend-search-results">{results.map(result => <SearchResult key={result.id} result={result} working={workingId === result.id} onAction={() => handleSearchAction(result)} />)}</div>}

      {incoming.length > 0 && <FriendRequestGroup title={`收到的申请 · ${incoming.length}`} requests={incoming} workingId={workingId} onRespond={(requestId, accept) => run(requestId, () => respondFriend(requestId, accept))} />}

      <div className="friend-section-title">我的好友</div>
      {snapshot.friends.length === 0 && <div className="friend-empty">还没有好友。搜索同服玩家，约定下一场地图争夺。</div>}
      <div className="friend-list">{snapshot.friends.map(friend => {
        const destination = friend.marchDestinationKey ? WARFRONT_NODE_MAP[friend.marchDestinationKey] : null
        return <div className="friend-row" key={friend.id}>
          <span className={`friend-status-dot${friend.online ? ' online' : ''}`} />
          <div className="friend-row-main">
            <b>{friend.name}</b>
            <small>{friend.sectName} · 战功 {fmt(friend.score)}</small>
            <span>{friend.online ? '在线 · 地图位置已同步' : '离线 · 保留上次位置'}</span>
            {destination && <em>正在行军 · {destination.name} · {friend.marchArriveAt ? `${Math.max(0, Math.ceil((friend.marchArriveAt - snapshot.serverTime) / 1000))} 秒抵达` : '途中'}</em>}
          </div>
          <button className="friend-remove" type="button" disabled={workingId === friend.id} onClick={() => void run(friend.id, () => removeFriend(friend.id))}>删除</button>
        </div>
      })}</div>

      {outgoing.length > 0 && <FriendRequestGroup title="等待回应" requests={outgoing} workingId={workingId} onRespond={() => Promise.resolve()} />}
      {error && <div className="sect-error friend-error">{error}</div>}
    </section>
  )
}

function SearchResult({ result, working, onAction }: { result: OnlinePlayerSearch; working: boolean; onAction: () => Promise<unknown> }) {
  const action = result.relation === 'friend' ? '已是好友' : result.relation === 'outgoing' ? '等待回应' : result.relation === 'incoming' ? '同意申请' : '加为好友'
  return <div className="friend-search-result">
    <span className={`friend-status-dot${result.online ? ' online' : ''}`} />
    <div className="friend-row-main"><b>{result.name}</b><small>{result.sectName} · 战功 {fmt(result.score)}</small></div>
    <button className="btn-sub" type="button" disabled={working || result.relation === 'friend' || result.relation === 'outgoing'} onClick={() => void onAction()}>{working ? '处理中' : action}</button>
  </div>
}

function FriendRequestGroup({ title, requests, workingId, onRespond }: { title: string; requests: WarfrontSnapshot['friendRequests']; workingId: string; onRespond: (requestId: string, accept: boolean) => Promise<unknown> }) {
  return <div className="friend-request-group">
    <div className="friend-section-title">{title}</div>
    {requests.map(request => <div className="friend-request-row" key={request.id}>
      <div><b>{request.playerName}</b><small>{request.sectName}</small></div>
      {request.direction === 'incoming' ? <span className="friend-request-actions"><button className="btn-sub" type="button" disabled={workingId === request.id} onClick={() => void onRespond(request.id, true)}>同意</button><button className="friend-remove" type="button" disabled={workingId === request.id} onClick={() => void onRespond(request.id, false)}>拒绝</button></span> : <em>等待回应</em>}
    </div>)}
  </div>
}
