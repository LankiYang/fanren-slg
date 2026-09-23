import { FormEvent, useState } from 'react'
import { useOnline } from '../online/onlineStore'

export function AccountGate() {
  const login = useOnline(x => x.login)
  const register = useOnline(x => x.register)
  const guest = useOnline(x => x.newIdentity)
  const error = useOnline(x => x.error)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [working, setWorking] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setWorking(true)
    if (mode === 'login') await login(username, password)
    else await register(username, password, displayName)
    setWorking(false)
  }
  return <main className="account-gate">
    <section className="account-gate-panel">
      <div className="account-gate-mark">凡人修仙传 · 苍梧战局</div>
      <h1>{mode === 'login' ? '登录你的修士' : '创建修士账号'}</h1>
      <p>账号数据保存在服务器，换设备登录也能继续洞府、宗门和战区进度。</p>
      <form onSubmit={submit}>
        <label>账号<input value={username} minLength={6} maxLength={24} onChange={e => setUsername(e.target.value)} placeholder="至少 6 位字母/数字" required /></label>
        <label>密码<input type="password" value={password} minLength={6} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" required /></label>
        {mode === 'register' && <label>修士名<input value={displayName} maxLength={12} onChange={e => setDisplayName(e.target.value)} placeholder="2—12 个字符，不可重名" required /></label>}
        <button className="btn-main" disabled={working}>{working ? '请稍候…' : mode === 'login' ? '进入苍梧战区' : '注册并开始修行'}</button>
      </form>
      {error && <div className="account-error">{error}</div>}
      <button className="account-switch" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '没有账号？注册新修士' : '已有账号？返回登录'}</button>
      <button className="account-guest" type="button" onClick={() => void guest()}>游客体验（数据仅绑定当前浏览器）</button>
    </section>
  </main>
}
