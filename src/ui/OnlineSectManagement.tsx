import { useState } from 'react'
import type { WarfrontSnapshot } from '../online/contracts'
import { useOnline } from '../online/onlineStore'
import { fmt } from './util'

export function OnlineSectManagement({ snapshot }: { snapshot: WarfrontSnapshot }) {
  const createSect = useOnline(state => state.createSect)
  const joinSect = useOnline(state => state.joinSect)
  const [sectName, setSectName] = useState('')
  const [working, setWorking] = useState(false)
  const [hint, setHint] = useState('')
  const otherSects = snapshot.sectLeaderboard.filter(row => row.id !== snapshot.player.sectId)

  return (
    <section className="online-sect-management" aria-label="宗门管理">
      <div className="section-title">宗门身份</div>
      <div className="sect-management">
        <div className="sect-management-current">
          <b>{snapshot.player.sectName}</b>
          <span>同宗玩家共享据点归属，互相不可攻击。</span>
        </div>
        <div className="sect-create-row">
          <input
            aria-label="新宗门名称"
            maxLength={12}
            placeholder="创建新宗门（2—12字）"
            value={sectName}
            onChange={event => setSectName(event.target.value)}
          />
          <button
            className="btn-sub"
            disabled={working || sectName.trim().length < 2}
            onClick={async () => {
              setWorking(true)
              const ok = await createSect(sectName)
              setWorking(false)
              if (ok) {
                setSectName('')
                setHint('已创建宗门')
              } else {
                setHint(useOnline.getState().error || '创建宗门失败')
              }
            }}
          >
            {working ? '处理中' : '创建'}
          </button>
        </div>
        {otherSects.map(row => (
          <div className="sect-row" key={row.id}>
            <span><b>{row.name}</b><small>战功 {fmt(row.score)}</small></span>
            <button
              className="btn-sub"
              disabled={working}
              onClick={async () => {
                setWorking(true)
                const ok = await joinSect(row.id)
                setWorking(false)
                setHint(ok ? `已加入${row.name}` : useOnline.getState().error || '加入宗门失败')
              }}
            >
              {working ? '处理中' : '加入'}
            </button>
          </div>
        ))}
        {hint && <div className="sect-error" role="status">{hint}</div>}
      </div>
    </section>
  )
}
