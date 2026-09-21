# 多人战区基础规格

## 目标

战区必须是共享服务器状态，而不是每个浏览器各自保存一份“对手”。第一阶段采用异步实时地图 SLG：玩家登录后拥有赛季军团，出征请求由服务端验证，部队沿共享地图道路移动，抵达后才结算，其他会话通过轮询看到行军、据点、榜单和战报变化。

## 当前边界

已实现：游客身份与每标签页独立会话 token；服务端权威赛季军团、兵损、冷却和据点归属；共享六据点、地图坐标、道路、玩家位置、单队行军和跨宗门反攻；抵达后服务端按统一战斗档案计算境界、修士、功法、法宝、丹药、灵装、兵种克制和策略倍率；战争令消耗与恢复；据点驻防、撤防、援军贡献记录和真实守军强度；个人榜、宗门榜、攻击者/防守者战报；请求编号幂等；宗门创建、加入和同宗据点保护；真实好友关系、玩家搜索、好友申请/同意/拒绝/删除、在线状态和好友行军目标同步；据点持续收益通过快照返回并进入洞府钱包，战报奖励按战报编号只入账一次；前端每 900ms 刷新共享战区并用位置过渡表现移动，战斗演出作为地图下战报抽屉。

暂未实现：WebSocket 帧同步、同时多队列行军、集结战、聊天、Redis 事件总线和按业务拆分的 PostgreSQL 表。这些属于下一阶段；当前版本应准确宣传为异步实时地图战争，不是实时 PvP 帧同步。当前已实现 PostgreSQL 单权威世界状态、连接池、数据库迁移、事务行锁和 JSON 开发 fallback。

## 权威边界

```text
本地 localStorage
  洞府建造、资源钱包、秘境 PvE、修士/功法/丹药/法宝与寻道掉落（养成状态开发过渡）

服务端 StateRepository
  玩家身份、宗门、赛季兵力、据点、战功、战报、幂等记录
  玩家地图位置、进行中的行军、行军到达结算（当前多人权威）

生产：PostgreSQL `fanren_world_state`（JSONB aggregate + revision + `SELECT ... FOR UPDATE`）
开发：JSON 文件 repository（单进程 fallback，不作为生产部署方案）
```

服务端永远不信任客户端提交的战力数字，只接受据点、策略、编队数量和白名单成长档案，并重新检查身份、兵力、统兵上限、同宗关系与冷却。成长档案中的等级、拥有状态、装备评分和丹药生效状态逐项校验上限；服务器依据标准化档案重新计算：

```text
单位战力 = 兵种基础
  × (1 + 修士专精 + 法宝)
  × 境界战力乘区
  × (1 + 攻伐功法)
  × 丹药倍率
  × (1 + 寻道灵装，最高 +35%)

编队战力 = Σ(单位战力 × 兵数 × 克制系数)
据点守军 = Σ(各驻军玩家档案重算的无克制编队战力) × 1.05
```

这样洞府升级、突破、招募/升级修士、研究功法、锻造法宝、服用丹药和寻道灵装会真实改变地图上的胜负，不再存在“本地战力一套、多人战区另一套”的分叉。每个 mutation 在 PostgreSQL 事务内读取全局世界行并加排他锁，领域函数成功后才更新 revision 和提交；HTTP 响应也在事务提交后发送。这样多个 API 进程不会同时覆盖行军、好友和占领结果。当前 JSON fallback 保留给无数据库开发和模拟脚本，正式部署应使用 Compose 或托管 PostgreSQL。

## 服务端部署拓扑

```text
浏览器
  -> Vite/Nginx 静态站点（/api 反向代理）
  -> Node API 多实例
       -> PostgreSQL 连接池
            -> fanren_world_state（当前权威赛季 aggregate）
```

`docker-compose.yml` 提供 PostgreSQL 和 API 容器。API 通过 `FANREN_API_HOST=0.0.0.0` 对外监听，`/api/health` 返回存储类型和 revision。后续拆分玩家、行军、战报表时，保持 `StateRepository` 和领域层接口不变；Redis 只用于事件广播、热点地图缓存和 WebSocket fan-out，不作为战斗胜负的最终权威。

## 身份与社交目录

- 玩家可通过 `POST /api/profile/name` 修改自己的修士名。服务端剔除危险字符，要求 2 至 12 个字符，并在当前赛季内校验名称唯一；改名后的名字会随快照同步到好友、地图和排行榜。
- `GET /api/social/players?online=1` 返回当前活跃修士目录，客户端可以不输入搜索词直接展示在线修士并发起好友申请。在线窗口仍由服务端的 `lastSeenAt` 判定，不能由客户端伪造。

## API

```text
POST /api/auth/guest
POST /api/profile/battle     # 同步白名单洞府成长档案，服务器校验后重算战力
GET  /api/warfront
POST /api/warfront/attack     # 旧客户端兼容接口：立即结算
POST /api/warfront/march      # 新主流程：创建异步地图行军
POST /api/warfront/recruit
POST /api/warfront/garrison
POST /api/warfront/withdraw
GET  /api/leaderboard
GET  /api/warfront/reports
GET  /api/sect
POST /api/sect/create
POST /api/sect/join
GET  /api/social/players?query=<名称或玩家 ID>
POST /api/social/friends/request
POST /api/social/friends/respond
POST /api/social/friends/remove
```

所有需要身份的请求使用 `Authorization: Bearer <token>`。行军请求必须带 `requestId`，服务端以 `playerId + action + requestId` 做幂等键。

## 验收场景

1. 打开两个浏览器标签页，分别进入战区，得到两个玩家和不同宗门。
2. A 点击地图上的目标据点派出行军；A 立刻扣兵，地图出现沿路线移动的军队。
3. B 刷新或等待轮询，在自己的地图上看到 A 的军队；抵达前目标据点不产生战报。
4. 行军抵达后，双方看到同一场战斗结果、据点版本、宗门和驻守玩家改变。
5. B 以克制兵种反攻；A 在战报中看到自己作为防守方。
6. 对同一请求重复提交，玩家兵力和战功保持不变；创建或加入宗门后，同宗据点不能攻击。
7. A 派援军驻防后，个人兵力下降、据点版本和守军战力上升；撤回后兵力恢复。
8. A 搜索 B 并发送好友申请，B 在另一会话收到申请并同意；双方好友列表和地图标记同步。
9. 好友 B 发起行军后，A 的好友信息显示 B 的行军目标；重复申请、自己加自己、非本人处理申请都被服务端拒绝。
10. 任一方删除好友后，双方下一次快照都不再返回该好友；重启 repository 后历史好友关系仍可读取。

## 迁移

联机 schema 从 1/2/3 升至 4。读取旧 JSON 或 PostgreSQL aggregate 时，缺少 `mapPosition` 的玩家按宗门出生点补齐，缺少 `march` 的玩家设为 `null`，缺少 `lastSeenAt` 的玩家先标为离线，缺少 `battleProfile` 的玩家补齐安全基线档案；缺少好友请求和好友关系表时按空表补齐；节点和旧战报保持兼容。数据库结构由 `server/db/migrations/001_world_state.sql` 创建，状态 revision 由数据库自增。

`WarfrontSnapshot` 增加 `battleProfile`、`player.battlePower`、`player.battleProfileUpdatedAt` 和 `warfrontIncome`。客户端把 `warfrontIncome` 写入本地收益倍率，把服务端战报的 `gained` 交给带持久化去重的本地入账器，避免 900ms 轮询或刷新导致重复奖励。正式迁移钱包到服务端时，保留这四个字段的语义，并把本地入账器替换成服务端 claim token。

## 好友系统

好友关系由服务端 `friendships` 表维护，好友申请由 `friendRequests` 表维护。申请、同意、拒绝和删除都必须带 Bearer token，并在 repository mutation 中持久化。服务端按双方玩家 ID 排序生成关系键，避免 A 加 B 与 B 加 A 形成重复关系。

好友快照只包含名称、宗门、战功、在线状态、当前位置和行军目标，不包含好友兵力或编队。在线窗口为最近 15 秒内完成身份认证；前端现有 900ms 轮询会自动刷新申请、在线状态和地图标记。好友行军目标通过 `marchDestinationKey` 同步，好友离线时不在地图上显示位置标记。

现有 `fanren-slg-save-v2` 不删除。当前洞府存档仍由本地模块读取；后续把养成也迁移到服务端时，应增加 `schemaVersion`、`serverPlayerId`、`migrationStatus` 和待重试队列，只允许服务端接收受限的迁移快照，不能让客户端直接覆盖资源、兵力、战功或据点。
