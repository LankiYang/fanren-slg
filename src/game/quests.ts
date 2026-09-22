// ═══ 成长任务 ═══
//
// 一期用「成长任务」同时承担两个职责：
//   1. 新手引导 —— 不做打断式的强制指引（web 端玩家容忍度低），改用任务清单牵引；
//   2. 留存钩子 —— 每完成一条给一笔资源，制造「再点一下」的理由。
//
// 任务全部是「检查当前状态是否达标」的纯函数，不需要额外埋点或事件系统，
// 因此天然幂等、不会因为漏记事件而卡住。

import type { GameState } from './types'
import type { GuideChapterId, GuideRoute } from './guide'
import { storageCap } from './balance'
import { totalPower, totalTroops } from './compute'

export interface Quest {
  id: string
  chapter: GuideChapterId
  name: string
  desc: string
  why: string
  how: string
  route: GuideRoute
  /** 是否已达成 */
  done: (s: GameState) => boolean
  /** 进度显示 current/target，可选 */
  progress?: (s: GameState) => { cur: number; target: number }
  /** 奖励（按当前仓库容量的比例给，避免后期奖励变得毫无意义） */
  rewardRatio: number
}

export const QUESTS: Quest[] = [
  {
    id: 'dongfu3', chapter: 'foundation', name: '开辟洞府', desc: '将洞府升至 3 级',
    why: '洞府提高仓库上限，并解除其他建筑的等级封顶。',
    how: '回到洞府，点中央主建筑；资源够就立即开始升级。', route: { kind: 'home', building: 'dongfu' },
    done: s => s.buildings.dongfu.level >= 3,
    progress: s => ({ cur: s.buildings.dongfu.level, target: 3 }),
    rewardRatio: 0.25,
  },
  {
    id: 'producers3', chapter: 'foundation', name: '广开财路', desc: '四座产出建筑均达到 3 级',
    why: '四种资源各有用途，均衡升级能避免后面只缺一种材料。',
    how: '依次点聚灵阵、灵田、矿脉、坊市，在升级页查看当前收益。', route: { kind: 'home' },
    done: s => ['juling', 'lingtian', 'kuangmai', 'fangshi']
      .every(k => s.buildings[k as keyof GameState['buildings']].level >= 3),
    progress: s => ({
      cur: ['juling', 'lingtian', 'kuangmai', 'fangshi']
        .filter(k => s.buildings[k as keyof GameState['buildings']].level >= 3).length,
      target: 4,
    }),
    rewardRatio: 0.30,
  },
  {
    id: 'seek10', chapter: 'foundation', name: '十次问道', desc: '完成 10 次寻道',
    why: '寻道同时给修为、四种灵材和随机灵装，是最稳定的主动成长按钮。',
    how: '在洞府右下连续点击寻道；机缘耗尽也能静心参悟，不会卡死主线。', route: { kind: 'home', focus: 'seek' },
    done: s => s.seek.total >= 10,
    progress: s => ({ cur: s.seek.total, target: 10 }),
    rewardRatio: 0.31,
  },
  {
    id: 'realm2', chapter: 'foundation', name: '初窥门径', desc: '突破至炼气五层',
    why: '境界会同时提高资源产出和全军战力，是所有系统共用的成长乘区。',
    how: '先用寻道填满修为，再收集灵气和其他突破资源，点击顶部境界按钮。', route: { kind: 'home' },
    done: s => s.realm >= 2,
    progress: s => ({ cur: s.realm, target: 2 }),
    // 任务列表是顺序引导，奖励比例必须单调不降，
    // 否则越往后的任务反而越不值，玩家没有继续推进的理由
    rewardRatio: 0.32,
  },
  {
    id: 'yanwu', chapter: 'battle', name: '操演之地', desc: '兴建演武场',
    why: '演武场解锁三种兵种和统兵上限，没有部众就无法承担失败兵损。',
    how: '洞府达到 3 级后，点击演武场兴建，再进入历练·演武训练。', route: { kind: 'home', building: 'yanwu' },
    done: s => s.buildings.yanwu.level >= 1,
    rewardRatio: 0.34,
  },
  {
    id: 'troops50', chapter: 'battle', name: '初聚部众', desc: '拥有 50 名部众',
    why: '出战只能带一部分兵，兵库越厚，失败后越能快速补回战线。',
    how: '进入历练·演武，按资源选择兵种训练；优先准备能克制当前秘境的兵种。', route: { kind: 'practice', section: 'army' },
    done: s => totalTroops(s) >= 50,
    progress: s => ({ cur: totalTroops(s), target: 50 }),
    rewardRatio: 0.36,
  },
  {
    id: 'stage5', chapter: 'battle', name: '青牛谷主', desc: '通关第 5 关',
    why: '秘境是修士、资源和后续系统的主要解锁线，也是检验编队的地方。',
    how: '历练·秘境先看敌方兵种，进编队点“一键择优”，确认后再出战。', route: { kind: 'practice', section: 'stage' },
    done: s => s.clearedStage >= 5,
    progress: s => ({ cur: s.clearedStage, target: 5 }),
    rewardRatio: 0.42,
  },
  {
    id: 'stage10', chapter: 'battle', name: '深入秘境', desc: '通关第 10 关',
    why: '推进关卡会带来资源和修士，战力提升不只来自建筑等级。',
    how: '失败后先查看兵损，补兵并调整克制，再挑战同一关，不会白白消耗首通奖励。', route: { kind: 'practice', section: 'stage' },
    done: s => s.clearedStage >= 10,
    progress: s => ({ cur: s.clearedStage, target: 10 }),
    rewardRatio: 0.44,
  },
  {
    id: 'cangjing', chapter: 'growth', name: '开藏经阁', desc: '兴建藏经阁',
    why: '藏经阁是永久科技线，越早开始研究，整个 30 天收益越高。',
    how: '洞府达到 6 级后，回到主城点击藏经阁并选择参研分支。', route: { kind: 'home', building: 'cangjing' },
    done: s => s.buildings.cangjing.level >= 1,
    rewardRatio: 0.46,
  },
  {
    id: 'gongfa1', chapter: 'growth', name: '第一门功法', desc: '完成一次功法参研',
    why: '功法是永久增益，采集、营造和攻伐三条路线对应不同发展方向。',
    how: '打开藏经阁，选择一条当前最缺的路线，参研完成后效果永久保留。', route: { kind: 'home', building: 'cangjing' },
    done: s => Object.values(s.gongfa).some(level => level > 0),
    progress: s => ({ cur: Object.values(s.gongfa).filter(level => level > 0).length, target: 1 }),
    rewardRatio: 0.48,
  },
  {
    id: 'liandan', chapter: 'growth', name: '炉火初成', desc: '兴建炼丹房',
    why: '丹药把灵药转换成限时产出或战力增益，适合在关键突破和出征前集中使用。',
    how: '洞府达到 4 级后点击炼丹房兴建；建成后记得炼制并服用。', route: { kind: 'home', building: 'liandan' },
    done: s => s.buildings.liandan.level >= 1,
    rewardRatio: 0.50,
  },
  {
    id: 'lianqi', chapter: 'growth', name: '锻造法宝', desc: '兴建炼器阁',
    why: '法宝提供稳定的兵种专精加成，能放大克制编队的收益。',
    how: '洞府达到 5 级后点击炼器阁兴建，优先锻造你最常带的主力兵种法宝。', route: { kind: 'home', building: 'lianqi' },
    done: s => s.buildings.lianqi.level >= 1,
    rewardRatio: 0.52,
  },
  {
    id: 'artifact1', chapter: 'growth', name: '法宝入阵', desc: '完成一次法宝锻造',
    why: '法宝等级和修士、功法共同组成中期战力，不要只盯着部众数量。',
    how: '进入炼器阁·锻造，选一件未锻造法宝点击锻造。', route: { kind: 'home', building: 'lianqi' },
    done: s => Object.values(s.artifacts).some(level => level > 0),
    progress: s => ({ cur: Object.values(s.artifacts).filter(level => level > 0).length, target: 1 }),
    rewardRatio: 0.55,
  },
  {
    id: 'realm6', chapter: 'growth', name: '筑基有成', desc: '突破至筑基初期',
    why: '筑基是中期分水岭，会提高产出和全军战力，并打开宗门大殿前置。',
    how: '寻道修为、灵气和洞府等级都达标后，在顶部境界按钮完成突破。', route: { kind: 'home' },
    done: s => s.realm >= 6,
    progress: s => ({ cur: s.realm, target: 6 }),
    rewardRatio: 0.57,
  },
  {
    id: 'zongmen', chapter: 'sect', name: '立身宗门', desc: '兴建宗门大殿',
    why: '宗门开启合围妖兽和协同玩法，是从单人养成进入多人循环的门槛。',
    how: '洞府达到 7 级后兴建宗门大殿；进入宗门面板参加合围。', route: { kind: 'home', building: 'zongmen' },
    done: s => s.buildings.zongmen.level >= 1,
    rewardRatio: 0.59,
  },
  {
    id: 'boss', chapter: 'sect', name: '合围之功', desc: '参与一次合围妖兽',
    why: '妖兽血量高于单人战力，同门伤害会补足结算；这是低风险的协作奖励来源。',
    how: '宗门面板妖兽刷新后点击发起合围，按结算档位领取资源。', route: { kind: 'sect' },
    done: s => s.lastBossAt > 0,
    rewardRatio: 0.62,
  },
  {
    id: 'expedition10', chapter: 'sect', name: '远征初功', desc: '获得 10 点远征积分',
    why: '远征令每日恢复，稳妥路线保进度，风险路线换更高积分；积分可兑换长期遗物。',
    how: '历练·远征选择当前层路线，失败会损兵且路线不推进，先用稳妥路线熟悉规则。', route: { kind: 'practice', section: 'expedition' },
    done: s => s.expeditionScore >= 10,
    progress: s => ({ cur: s.expeditionScore, target: 10 }),
    rewardRatio: 0.65,
  },
  {
    id: 'stage20', chapter: 'sect', name: '踏破四境', desc: '通关第 20 关',
    why: '中段关卡会持续解锁修士和奖励，推图进度也决定你能否参加更高收益玩法。',
    how: '继续按敌方兵种调编队；战力不够时回演武补兵，再用功法和法宝补乘区。', route: { kind: 'practice', section: 'stage' },
    done: s => s.clearedStage >= 20,
    progress: s => ({ cur: s.clearedStage, target: 20 }),
    rewardRatio: 0.68,
  },
  {
    id: 'warfront-march', chapter: 'warfront', name: '战区首战', desc: '在共享战区派出一次行军',
    why: '地图据点会产生持续资源，首战是把本地养成转换成多人收益的关键一步。',
    how: '打开战区，点地图据点查看守军，配置克制编队后展开指挥栏并派出行军。', route: { kind: 'warfront' },
    done: s => s.guideFlags.includes('warfront-march'),
    rewardRatio: 0.71,
  },
  {
    id: 'warfront-garrison', chapter: 'warfront', name: '守住据点', desc: '向战区据点派遣一次援军',
    why: '占领不是终点，驻防援军才会提高守军并保护持续收益；兵损也会真实同步。',
    how: '战区点“详情”，在宗门驻防中滑动分配兵力，确认派遣援军。', route: { kind: 'warfront' },
    done: s => s.guideFlags.includes('warfront-garrison'),
    rewardRatio: 0.74,
  },
  {
    id: 'friend', chapter: 'warfront', name: '结识同道', desc: '添加一位好友',
    why: '好友能看到彼此在线状态、地图位置和行军目标，协同抢点比单人盲打更可靠。',
    how: '战区点“好友”，刷新在线修士，直接点击“加为好友”，也可按名称搜索。', route: { kind: 'warfront' },
    done: s => s.guideFlags.includes('friend-added'),
    rewardRatio: 0.77,
  },
  {
    id: 'realm9', chapter: 'warfront', name: '结丹在望', desc: '突破至结丹初期',
    why: '结丹会把后期资源和战力乘区再抬一档，是争夺高价值据点的长期门槛。',
    how: '维持产出和寻道点击，优先完成当前境界突破，不要把灵气全花在非必要升级上。', route: { kind: 'home' },
    done: s => s.realm >= 9,
    progress: s => ({ cur: s.realm, target: 9 }),
    rewardRatio: 0.80,
  },
  {
    id: 'expedition100', chapter: 'endgame', name: '远征老手', desc: '累计获得 100 点远征积分',
    why: '远征积分连接周奖励、28 天游历和遗物商店，是后期每天都有目标的长期线。',
    how: '每天消耗恢复的远征令，稳妥保底、风险冲分，按当前兵力选择路线。', route: { kind: 'practice', section: 'expedition' },
    done: s => s.expeditionScore >= 100,
    progress: s => ({ cur: s.expeditionScore, target: 100 }),
    rewardRatio: 0.83,
  },
  {
    id: 'power100k', chapter: 'endgame', name: '一方势力', desc: '总战力达到 10 万',
    why: '战力是地图攻防、秘境和妖兽共同使用的底盘指标，但不能替代兵种克制。',
    how: '集中升级主力兵种对应修士、法宝和功法，再补充兵力和境界。', route: { kind: 'practice', section: 'army' },
    done: s => totalPower(s) >= 100000,
    progress: s => ({ cur: Math.round(totalPower(s)), target: 100000 }),
    rewardRatio: 0.86,
  },
  {
    id: 'stage30', chapter: 'endgame', name: '深入天南', desc: '通关第 30 关',
    why: '后期秘境是检验完整养成链的 PvE 目标，失败只损兵不吞首通奖励。',
    how: '根据敌方兵种做专门编队，必要时用丹药和法宝窗口集中突破。', route: { kind: 'practice', section: 'stage' },
    done: s => s.clearedStage >= 30,
    progress: s => ({ cur: s.clearedStage, target: 30 }),
    rewardRatio: 0.88,
  },
  {
    id: 'realm10', chapter: 'endgame', name: '结丹中期', desc: '突破至结丹中期',
    why: '后期突破需要在建造、寻道、远征和战区收益之间安排上线节奏。',
    how: '每天先清资源与远征，再决定是否投入战区战争令，最后把修为推到突破线。', route: { kind: 'home' },
    done: s => s.realm >= 10,
    progress: s => ({ cur: s.realm, target: 10 }),
    rewardRatio: 0.95,
  },
]

/** 任务奖励：按当前仓库容量比例，保证全期都有意义 */
export function questReward(s: GameState, q: Quest) {
  const cap = storageCap(s.buildings.dongfu.level)
  return {
    lingshi: Math.round(cap * q.rewardRatio),
    lingqi: Math.round(cap * q.rewardRatio * 0.6),
    lingyao: Math.round(cap * q.rewardRatio * 0.6),
    kuanglingcai: Math.round(cap * q.rewardRatio * 0.6),
  }
}

/** 当前应当引导玩家去做的那条任务（第一条未领取的） */
export function currentQuest(claimed: string[]): Quest | null {
  return QUESTS.find(q => !claimed.includes(q.id)) ?? null
}
