import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AttackPayload, CreateSectPayload, FriendRequestPayload, GameCommandRequest, GarrisonPayload, LoginAccountPayload, MarchPayload, RegisterAccountPayload, RemoveFriendPayload, RenamePayload, RespondFriendRequestPayload, SendChatPayload, SyncBattleProfilePayload, WarfrontPreviewPayload, WithdrawPayload } from '../src/online/contracts'
import { attack, authenticate, chatMessages, createGuest, createSession, createSect, createSnapshot, DomainError, gameCommand, gameSnapshot, garrison, joinSect, loginAccount, march, previewWarfront, recruit, registerAccount, removeFriend, renamePlayer, respondFriendRequest, searchPlayers, sendChatMessage, sendFriendRequest, syncBattleProfile, withdrawGarrison } from './domain'
import { createRepository } from './repositoryFactory'
import type { StateRepository } from './repository'

type ChatChannel = 'world' | 'sect'

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.FANREN_CORS_ORIGIN || '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(body))
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 32_000) throw new DomainError('请求内容过大', 413)
  }
  try { return (raw ? JSON.parse(raw) : {}) as T } catch { throw new DomainError('JSON 格式错误') }
}

function tokenOf(req: IncomingMessage): string | undefined {
  const value = req.headers.authorization
  return value?.startsWith('Bearer ') ? value.slice(7) : undefined
}

async function commitAndSend<T>(repository: StateRepository, res: ServerResponse, status: number, mutation: (state: Parameters<Parameters<StateRepository['mutate']>[0]>[0]) => T | Promise<T>): Promise<void> {
  const body = await repository.mutate(mutation)
  send(res, status, body)
}

export async function startApiServer(port = Number(process.env.FANREN_API_PORT || 5181), repository: StateRepository = createRepository()) {
  await repository.load()
  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, {})
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') {
        const health = await repository.health()
        return send(res, 200, { ok: true, service: 'fanren-slg-multiplayer', ...health, time: Date.now() })
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/guest') {
        const body = await readJson<{ displayName?: string }>(req)
        return await commitAndSend(repository, res, 201, state => {
          const player = createGuest(state, body.displayName)
          return { token: player.token, snapshot: createSnapshot(state, player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/register') {
        const body = await readJson<RegisterAccountPayload>(req)
        return await commitAndSend(repository, res, 201, state => {
          const created = registerAccount(state, body.username, body.password, body.displayName)
          const token = createSession(state, created.account, created.player)
          return { token, account: { id: created.account.id, username: created.account.username, playerId: created.account.playerId }, snapshot: createSnapshot(state, created.player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        const body = await readJson<LoginAccountPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const result = loginAccount(state, body.username, body.password)
          return { token: result.token, account: { id: result.account.id, username: result.account.username, playerId: result.account.playerId }, snapshot: createSnapshot(state, result.player) }
        })
      }
      if (req.method === 'GET' && url.pathname === '/api/chat/messages') {
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          const channel = url.searchParams.get('channel') as ChatChannel
          return { messages: chatMessages(state, player, channel, url.searchParams.get('after') ?? undefined), serverTime: Date.now() }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/chat/messages') {
        const body = await readJson<SendChatPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          return { messages: sendChatMessage(state, player, body.channel, body.text), serverTime: Date.now() }
        })
      }
      if (req.method === 'GET' && url.pathname === '/api/game/snapshot') {
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          return gameSnapshot(state, player)
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/game/command') {
        const body = await readJson<GameCommandRequest>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          if (!body || typeof body.command !== 'string') throw new DomainError('缺少游戏命令')
          return gameCommand(state, player, body.command, body.payload, body.requestId)
        })
      }
      if (req.method === 'GET' && url.pathname === '/api/social/players') {
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          return { players: searchPlayers(state, player, url.searchParams.get('query') ?? '', url.searchParams.get('online') === '1') }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/profile/name') {
        const body = await readJson<RenamePayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          renamePlayer(state, player, body.displayName)
          return createSnapshot(state, player)
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/profile/battle') {
        const body = await readJson<SyncBattleProfilePayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          syncBattleProfile(state, player, body)
          return { snapshot: createSnapshot(state, player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/social/friends/request') {
        const body = await readJson<FriendRequestPayload>(req)
        return await commitAndSend(repository, res, 201, state => {
          const player = authenticate(state, tokenOf(req))
          sendFriendRequest(state, player, body.targetPlayerId)
          return createSnapshot(state, player)
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/social/friends/respond') {
        const body = await readJson<RespondFriendRequestPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          respondFriendRequest(state, player, body.requestId, body.accept)
          return createSnapshot(state, player)
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/social/friends/remove') {
        const body = await readJson<RemoveFriendPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          removeFriend(state, player, body.friendId)
          return createSnapshot(state, player)
        })
      }
      if (req.method === 'GET' && ['/api/me', '/api/warfront', '/api/leaderboard', '/api/warfront/reports', '/api/sect'].includes(url.pathname)) {
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          return createSnapshot(state, player)
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/warfront/attack') {
        const body = await readJson<AttackPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          const report = attack(state, player, body)
          return { report, snapshot: createSnapshot(state, player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/warfront/march') {
        const body = await readJson<MarchPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          march(state, player, body)
          return { snapshot: createSnapshot(state, player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/warfront/preview') {
        const body = await readJson<WarfrontPreviewPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          return previewWarfront(state, player, body)
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/warfront/recruit') {
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          const gained = recruit(player)
          return { gained, snapshot: createSnapshot(state, player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/warfront/garrison') {
        const body = await readJson<GarrisonPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          garrison(state, player, body)
          return { snapshot: createSnapshot(state, player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/warfront/withdraw') {
        const body = await readJson<WithdrawPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          withdrawGarrison(state, player, body)
          return { snapshot: createSnapshot(state, player) }
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/sect/create') {
        const body = await readJson<CreateSectPayload>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          createSect(state, player, body.name)
          return createSnapshot(state, player)
        })
      }
      if (req.method === 'POST' && url.pathname === '/api/sect/join') {
        const body = await readJson<{ sectId: string }>(req)
        return await commitAndSend(repository, res, 200, state => {
          const player = authenticate(state, tokenOf(req))
          joinSect(state, player, body.sectId)
          return createSnapshot(state, player)
        })
      }
      send(res, 404, { error: '接口不存在', code: 'NOT_FOUND' })
    } catch (error) {
      if (res.headersSent || res.writableEnded) return
      const known = error instanceof DomainError
      send(res, known ? error.status : 500, {
        error: known ? error.message : '服务器内部错误',
        code: known ? error.code : 'INTERNAL_ERROR',
      })
      if (!known) console.error(error)
    }
  })
  server.once('close', () => { void repository.close() })
  server.requestTimeout = 15_000
  server.headersTimeout = 16_000
  server.keepAliveTimeout = 5_000
  await new Promise<void>(resolve => server.listen(port, process.env.FANREN_API_HOST || '127.0.0.1', resolve))
  return server
}
