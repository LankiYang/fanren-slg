// ═══ 成长任务 ═══
//
// 一期用「成长任务」同时承担两个职责：
//   1. 新手引导 —— 不做打断式的强制指引（web 端玩家容忍度低），改用任务清单牵引；
//   2. 留存钩子 —— 每完成一条给一笔资源，制造「再点一下」的理由。
//
// 任务全部是「检查当前状态是否达标」的纯函数，不需要额外埋点或事件系统，
// 因此天然幂等、不会因为漏记事件而卡住。

import type { GameState } from './types'
import { storageCap } from './balance'
import { totalPower, totalTroops } from './compute'

export interface Quest {
  id: string
  name: string
  desc: string
  /** 是否已达成 */
  done: (s: GameState) => boolean
  /** 进度显示 current/target，可选 */
  progress?: (s: GameState) => { cur: number; target: number }
  /** 奖励（按当前仓库容量的比例给，避免后期奖励变得毫无意义） */
  rewardRatio: number
}

export const QUESTS: Quest[] = [
  {
    id: 'dongfu3', name: '开辟洞府', desc: '将洞府升至 3 级',
    done: s => s.buildings.dongfu.level >= 3,
    progress: s => ({ cur: s.buildings.dongfu.level, target: 3 }),
    rewardRatio: 0.25,
  },
  {
    id: 'producers3', name: '广开财路', desc: '四座产出建筑均达到 3 级',
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
    id: 'realm2', name: '初窥门径', desc: '突破至炼气五层',
    done: s => s.realm >= 2,
    progress: s => ({ cur: s.realm, target: 2 }),
    // 任务列表是顺序引导，奖励比例必须单调不降，
    // 否则越往后的任务反而越不值，玩家没有继续推进的理由
    rewardRatio: 0.30,
  },
  {
    id: 'yanwu', name: '操演之地', desc: '兴建演武场',
    done: s => s.buildings.yanwu.level >= 1,
    rewardRatio: 0.30,
  },
  {
    id: 'troops50', name: '初聚部众', desc: '拥有 50 名部众',
    done: s => totalTroops(s) >= 50,
    progress: s => ({ cur: totalTroops(s), target: 50 }),
    rewardRatio: 0.30,
  },
  {
    id: 'stage5', name: '青牛谷主', desc: '通关第 5 关',
    done: s => s.clearedStage >= 5,
    progress: s => ({ cur: s.clearedStage, target: 5 }),
    rewardRatio: 0.40,
  },
  {
    id: 'realm6', name: '筑基有成', desc: '突破至筑基初期',
    done: s => s.realm >= 6,
    progress: s => ({ cur: s.realm, target: 6 }),
    rewardRatio: 0.45,
  },
  {
    id: 'zongmen', name: '立身宗门', desc: '兴建宗门大殿',
    done: s => s.buildings.zongmen.level >= 1,
    rewardRatio: 0.45,
  },
  {
    id: 'boss', name: '合围之功', desc: '参与一次合围妖兽',
    done: s => s.lastBossAt > 0,
    rewardRatio: 0.50,
  },
  {
    id: 'stage20', name: '踏破四境', desc: '通关第 20 关',
    done: s => s.clearedStage >= 20,
    progress: s => ({ cur: s.clearedStage, target: 20 }),
    rewardRatio: 0.60,
  },
  {
    id: 'power100k', name: '一方势力', desc: '总战力达到 10 万',
    done: s => totalPower(s) >= 100000,
    progress: s => ({ cur: Math.round(totalPower(s)), target: 100000 }),
    rewardRatio: 0.60,
  },
  {
    id: 'realm9', name: '结丹在望', desc: '突破至结丹初期',
    done: s => s.realm >= 9,
    progress: s => ({ cur: s.realm, target: 9 }),
    rewardRatio: 0.70,
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
