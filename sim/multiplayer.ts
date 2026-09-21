import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { startApiServer } from '../server/app'
import { JsonRepository } from '../server/repository'
import { battlePowerFromBattleProfile } from '../src/game/compute'
import type { AttackPayload, GuestAuthResponse, MarchPayload, RenamePayload, WarfrontSnapshot } from '../src/online/contracts'

const temp = await mkdtemp(join(tmpdir(), 'fanren-slg-mp-'))
const server: Server = await startApiServer(0, new JsonRepository(join(temp, 'state.json')))
const address = server.address()
assert(address && typeof address === 'object')
const base = `http://127.0.0.1:${address.port}`

async function json<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  })
  const body = await response.json()
  assert.equal(response.ok, true, `${path}: ${JSON.stringify(body)}`)
  return body as T
}

try {
  const a = await json<GuestAuthResponse>('/api/auth/guest', { method: 'POST', body: JSON.stringify({ displayName: '甲方道友' }) })
  const b = await json<GuestAuthResponse>('/api/auth/guest', { method: 'POST', body: JSON.stringify({ displayName: '乙方道友' }) })
  assert.notEqual(a.snapshot.player.id, b.snapshot.player.id, '两个会话必须得到不同玩家')
  assert.notEqual(a.snapshot.player.sectId, b.snapshot.player.sectId, '前两个测试玩家应分属不同宗门')

  const strongerProfile = {
    ...a.snapshot.battleProfile,
    realm: 4,
    cultivators: { ...a.snapshot.battleProfile.cultivators, hanli: { owned: true, level: 5 } },
    gongfa: { ...a.snapshot.battleProfile.gongfa, w_power: 2 },
    artifacts: { ...a.snapshot.battleProfile.artifacts, shield: 2 },
    equipmentPower: 180,
  }
  const syncedResponse = await json<{ snapshot: WarfrontSnapshot }>('/api/profile/battle', {
    method: 'POST', body: JSON.stringify({ profile: strongerProfile }),
  }, a.token)
  const synced = syncedResponse.snapshot
  assert(synced.player.battlePower > a.snapshot.player.battlePower, '洞府养成档案同步后，服务器战力必须上升')
  assert.equal(synced.battleProfile.realm, 4, '服务器应返回标准化后的境界档案')
  const invalidProfile = await fetch(`${base}/api/profile/battle`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${a.token}` },
    body: JSON.stringify({ profile: { ...strongerProfile, realm: 999 } }),
  })
  assert.equal(invalidProfile.status, 400, '越界成长档案必须由服务端拒绝')
  await json<{ snapshot: WarfrontSnapshot }>('/api/profile/battle', {
    method: 'POST', body: JSON.stringify({ profile: { ...strongerProfile, troops: { ...b.snapshot.battleProfile.troops } } }),
  }, b.token)

  const onlineDirectory = await json<{ players: { id: string; online: boolean }[] }>('/api/social/players?online=1', {}, a.token)
  assert.equal(onlineDirectory.players.find(player => player.id === b.snapshot.player.id)?.online, true, '在线目录必须返回乙方')
  const renamed = await json<WarfrontSnapshot>('/api/profile/name', {
    method: 'POST', body: JSON.stringify({ displayName: '乙方新名' } satisfies RenamePayload),
  }, b.token)
  assert.equal(renamed.player.name, '乙方新名', '玩家应能修改自己的修士名')
  const playerSearch = await json<{ players: { id: string; relation: string }[] }>(`/api/social/players?query=${encodeURIComponent('乙方新名')}`, {}, a.token)
  assert.equal(playerSearch.players.find(player => player.id === b.snapshot.player.id)?.relation, 'none', '改名后玩家目录必须能搜索到乙方')
  const friendRequested = await json<WarfrontSnapshot>('/api/social/friends/request', {
    method: 'POST', body: JSON.stringify({ targetPlayerId: b.snapshot.player.id }),
  }, a.token)
  const request = friendRequested.friendRequests.find(item => item.playerId === b.snapshot.player.id && item.direction === 'outgoing')
  assert(request, '甲方发送后必须看到待回应申请')
  const bPending = await json<WarfrontSnapshot>('/api/warfront', {}, b.token)
  const incoming = bPending.friendRequests.find(item => item.playerId === a.snapshot.player.id && item.direction === 'incoming')
  assert(incoming, '乙方必须收到好友申请')
  const accepted = await json<WarfrontSnapshot>('/api/social/friends/respond', {
    method: 'POST', body: JSON.stringify({ requestId: incoming.id, accept: true }),
  }, b.token)
  assert.equal(accepted.friends.find(friend => friend.id === a.snapshot.player.id)?.online, true, '同意后乙方必须看到在线好友')
  const aFriends = await json<WarfrontSnapshot>('/api/warfront', {}, a.token)
  assert.equal(aFriends.friends.find(friend => friend.id === b.snapshot.player.id)?.name, '乙方新名', '甲方必须同步看到好友改名')
  const duplicateFriend = await fetch(`${base}/api/social/friends/request`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${a.token}` },
    body: JSON.stringify({ targetPlayerId: b.snapshot.player.id }),
  })
  assert.equal(duplicateFriend.status, 409, '已经是好友后重复申请必须拒绝')
  const selfFriend = await fetch(`${base}/api/social/friends/request`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${a.token}` },
    body: JSON.stringify({ targetPlayerId: a.snapshot.player.id }),
  })
  assert.equal(selfFriend.status, 400, '不能添加自己为好友')

  const attackA: AttackPayload = {
    requestId: 'test-a-capture', nodeKey: 'mist-gate', tactic: 'raid',
    formation: { kuilei: 100, yushou: 0, fuxiu: 0 },
  }
  const first = await json<{ snapshot: WarfrontSnapshot; report: { id: string; win: boolean; myPower: number } }>('/api/warfront/attack', { method: 'POST', body: JSON.stringify(attackA) }, a.token)
  assert.equal(first.report.win, true, '甲方应攻下迷雾关')
  assert(first.report.myPower > 1500, '战报战力必须使用同步后的境界/修士/功法/法宝加成')
  assert.equal(first.report.myPower, Math.round(battlePowerFromBattleProfile(strongerProfile, attackA.formation, 'yushou')), '前端共享公式与服务端战报必须一致')
  assert(first.snapshot.warfrontIncome.lingshi > 0, '占领据点后快照必须返回持续资源收益')
  const troopsAfterFirst = first.snapshot.player.troops.kuilei
  const scoreAfterFirst = first.snapshot.player.score

  const duplicate = await json<{ snapshot: WarfrontSnapshot; report: { id: string } }>('/api/warfront/attack', { method: 'POST', body: JSON.stringify(attackA) }, a.token)
  assert.equal(duplicate.report.id, first.report.id, '重复请求必须返回同一战报')
  assert.equal(duplicate.snapshot.player.troops.kuilei, troopsAfterFirst, '幂等重放不能再次扣兵')
  assert.equal(duplicate.snapshot.player.score, scoreAfterFirst, '幂等重放不能再次加分')
  assert.equal(first.snapshot.player.warEnergy, 2, '一次出征应消耗一枚战争令')

  const capturedNode = first.snapshot.nodes.find(x => x.key === 'mist-gate')!
  const garrisoned = await json<{ snapshot: WarfrontSnapshot }>('/api/warfront/garrison', {
    method: 'POST', body: JSON.stringify({ requestId: 'test-garrison', nodeKey: 'mist-gate', formation: { kuilei: 0, yushou: 48, fuxiu: 0 } }),
  }, a.token)
  const reinforcedNode = garrisoned.snapshot.nodes.find(x => x.key === 'mist-gate')!
  assert(reinforcedNode.garrisonTotal > capturedNode.garrisonTotal, '驻防应增加据点真实守军')
  assert.equal(garrisoned.snapshot.player.troops.yushou, 72, '派遣驻军应从个人兵力扣除')
  assert.equal(reinforcedNode.garrisonByMe.yushou, 48, '服务端应记录援军贡献者')

  const withdrawn = await json<{ snapshot: WarfrontSnapshot }>('/api/warfront/withdraw', {
    method: 'POST', body: JSON.stringify({ requestId: 'test-withdraw', nodeKey: 'mist-gate', formation: { kuilei: 0, yushou: 48, fuxiu: 0 } }),
  }, a.token)
  assert.equal(withdrawn.snapshot.player.troops.yushou, 120, '撤回驻军应返还个人兵力')
  assert.equal(withdrawn.snapshot.nodes.find(x => x.key === 'mist-gate')!.garrisonTotal, capturedNode.garrisonTotal, '撤回后守军应恢复原值')
  const reinforcedAgain = await json<{ snapshot: WarfrontSnapshot }>('/api/warfront/garrison', {
    method: 'POST', body: JSON.stringify({ requestId: 'test-garrison-again', nodeKey: 'mist-gate', formation: { kuilei: 0, yushou: 48, fuxiu: 0 } }),
  }, a.token)

  const bView = await json<WarfrontSnapshot>('/api/warfront', {}, b.token)
  assert.equal(bView.nodes.find(x => x.key === 'mist-gate')?.ownerPlayerId, a.snapshot.player.id, '乙方必须看到甲方的占领结果')
  assert.equal(bView.nodes.find(x => x.key === 'mist-gate')?.garrisonTotal, reinforcedAgain.snapshot.nodes.find(x => x.key === 'mist-gate')!.garrisonTotal, '乙方必须看到援军后的守军')

  const marchB: MarchPayload = {
    requestId: 'test-b-march', nodeKey: 'moonwell', tactic: 'cautious',
    formation: { kuilei: 120, yushou: 0, fuxiu: 0 },
  }
  const launched = await json<{ snapshot: WarfrontSnapshot }>('/api/warfront/march', { method: 'POST', body: JSON.stringify(marchB) }, b.token)
  assert.equal(launched.snapshot.armies.filter(x => x.playerId === b.snapshot.player.id).length, 1, '发起行军后服务端必须返回移动部队')
  assert.equal(launched.snapshot.player.troops.kuilei, 0, '发起行军必须立刻扣除出征兵力')
  const aDuringMarch = await json<WarfrontSnapshot>('/api/warfront', {}, a.token)
  assert(aDuringMarch.armies.some(x => x.playerId === b.snapshot.player.id), '其他玩家必须看到行军中的军队')
  assert.equal(aDuringMarch.friends.find(friend => friend.id === b.snapshot.player.id)?.marchDestinationKey, marchB.nodeKey, '好友信息必须同步行军目标')
  let arrived = launched.snapshot
  const marchDeadline = Date.now() + 12_000
  while (arrived.armies.some(x => x.playerId === b.snapshot.player.id) && Date.now() < marchDeadline) {
    await new Promise(resolve => setTimeout(resolve, 300))
    arrived = await json<WarfrontSnapshot>('/api/warfront', {}, b.token)
  }
  assert.equal(arrived.armies.some(x => x.playerId === b.snapshot.player.id), false, '抵达后行军必须从地图快照移除')
  assert(arrived.reports.some(x => x.requestId === marchB.requestId), '抵达后才应生成服务端战报')
  assert.equal(arrived.nodes.find(x => x.key === 'moonwell')?.ownerPlayerId, b.snapshot.player.id, '抵达后胜利应占领目标据点')
  while (Date.now() < arrived.player.cooldownUntil) await new Promise(resolve => setTimeout(resolve, 250))

  const attackB: AttackPayload = {
    requestId: 'test-b-counter', nodeKey: 'mist-gate', tactic: 'assault',
    formation: { kuilei: 0, yushou: 0, fuxiu: 120 },
  }
  const second = await json<{ snapshot: WarfrontSnapshot; report: { win: boolean } }>('/api/warfront/attack', { method: 'POST', body: JSON.stringify(attackB) }, b.token)
  assert.equal(second.report.win, true, '乙方应能反攻甲方据点')
  assert.equal(second.snapshot.nodes.find(x => x.key === 'mist-gate')?.ownerPlayerId, b.snapshot.player.id)

  const aView = await json<WarfrontSnapshot>('/api/warfront', {}, a.token)
  assert(aView.reports.some(x => x.attackerId === b.snapshot.player.id && x.defenderPlayerId === a.snapshot.player.id), '甲方必须看到被攻击战报')

  const sameSectAttack = await fetch(`${base}/api/warfront/attack`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${b.token}` },
    body: JSON.stringify({ requestId: 'test-same-sect', nodeKey: 'mist-gate', tactic: 'raid', formation: { kuilei: 0, yushou: 0, fuxiu: 120 } }),
  })
  assert.equal(sameSectAttack.status, 400, '同宗据点必须禁止攻击')

  const created = await json<WarfrontSnapshot>('/api/sect/create', { method: 'POST', body: JSON.stringify({ name: '测试宗门' }) }, a.token)
  assert.equal(created.player.sectName, '测试宗门', '玩家应能创建宗门')
  const joined = await json<WarfrontSnapshot>('/api/sect/join', { method: 'POST', body: JSON.stringify({ sectId: created.player.sectId }) }, b.token)
  assert.equal(joined.player.sectId, created.player.sectId, '玩家应能加入其他宗门')
  const removed = await json<WarfrontSnapshot>('/api/social/friends/remove', {
    method: 'POST', body: JSON.stringify({ friendId: a.snapshot.player.id }),
  }, b.token)
  assert.equal(removed.friends.some(friend => friend.id === a.snapshot.player.id), false, '删除好友后乙方列表必须移除')
  const aAfterRemove = await json<WarfrontSnapshot>('/api/warfront', {}, a.token)
  assert.equal(aAfterRemove.friends.some(friend => friend.id === b.snapshot.player.id), false, '删除好友后甲方列表必须同步移除')
  console.log('✓ 多人联机：双身份、好友申请/同意/删除、共享地图、反攻、兵损与幂等校验全部通过')
} finally {
  await new Promise<void>(resolve => server.close(() => resolve()))
}
