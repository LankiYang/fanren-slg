import type { BuildingKey, GameState } from './types'
import { QUESTS, type Quest } from './quests'
import type { GameDerivedSnapshot } from '../online/contracts'

export type GuideChapterId = 'foundation' | 'battle' | 'growth' | 'sect' | 'warfront' | 'endgame'
export type PracticeSection = 'army' | 'stage' | 'expedition' | 'cultivator'

export type GuideRoute = (
  | { kind: 'home'; building?: BuildingKey; focus?: 'seek' }
  | { kind: 'practice'; section: PracticeSection }
  | { kind: 'warfront' }
  | { kind: 'sect' }
) & { guideId?: string }

export interface GuideChapter {
  id: GuideChapterId
  dayRange: string
  title: string
  subtitle: string
  why: string
  questIds: string[]
  routines: string[]
  next: string
}

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: 'foundation',
    dayRange: 'D1—D3',
    title: '开府立足',
    subtitle: '先让资源循环转起来，再谈出征',
    why: '洞府决定仓库和建筑上限；产出建筑决定你每天能升级几次。先把四种资源的入口都打开，后面的战斗才不会因为缺粮缺材停摆。',
    questIds: ['dongfu3', 'producers3', 'seek10', 'realm2'],
    routines: ['上线先收满仓资源', '点 10 次寻道，把修为和第一件灵装装上', '有资源就开建，离线前确认队列没有空着'],
    next: '资源稳定后，进入演武场练兵，用克制打第一批秘境。',
  },
  {
    id: 'battle',
    dayRange: 'D3—D7',
    title: '秘境立威',
    subtitle: '练兵、编队、克制，才是真正的战力',
    why: '秘境不是单纯比面板。统兵名额有限，带对克制兵种能把同一批部众打出更高战力；失败会损兵，所以先看敌方再出战。',
    questIds: ['yanwu', 'troops50', 'stage5', 'stage10'],
    routines: ['演武场补兵，不让兵力上限空着', '挑战前看敌方兵种，点击一键择优再确认', '失败先补兵、调克制，不要连续用残军硬撞'],
    next: '秘境打通后，建筑会逐步解锁功法、丹药和法宝三条养成线。',
  },
  {
    id: 'growth',
    dayRange: 'D7—D14',
    title: '筑基成势',
    subtitle: '把四种资源分别投入长期战力',
    why: '灵气、灵药、矿灵材不是多余库存：它们分别对应功法、丹药和法宝。三条线叠加后，才有能力挑战中段秘境和宗门内容。',
    questIds: ['cangjing', 'gongfa1', 'liandan', 'lianqi', 'artifact1', 'realm6'],
    routines: ['藏经阁保持参研队列', '炼丹房做一颗限时增益并在出征前服用', '炼器阁优先强化主力克制兵种的法宝', '修为和资源同时满足时再突破'],
    next: '筑基之后，建宗门、打妖兽、跑远征，开始从单人养成转向协作收益。',
  },
  {
    id: 'sect',
    dayRange: 'D14—D21',
    title: '宗门立身',
    subtitle: '用协作玩法把每天的行动令花出价值',
    why: '宗门和远征提供独立积分、货币与遗物，不会挤占建造资源；它们是中期稳定成长和 28 天游历奖励的来源。',
    questIds: ['zongmen', 'boss', 'expedition10', 'stage20'],
    routines: ['每天用远征令推进路线，失败也要读清兵损和路线惩罚', '妖兽刷新后参与一次合围，按自己的战力领取档位奖励', '把远征币换成当前最缺的遗物或资源'],
    next: '当秘境和宗门都站稳，就去共享战区争夺据点收益。',
  },
  {
    id: 'warfront',
    dayRange: 'D21—D30',
    title: '战区争雄',
    subtitle: '地图上的每一步都影响下一次出征',
    why: '战区是多人 SLG 的核心：据点会产出资源，行军会暴露路线，战争令和兵损限制你的连续进攻。宗门驻防与好友协同能把一次占领变成长期收益。',
    questIds: ['warfront-march', 'warfront-garrison', 'friend', 'realm9'],
    routines: ['先点地图据点看守军和产出，再选行军策略', '预计战力不足时换编队或先回秘境补兵', '占领后派援军驻防，并在好友面板添加在线修士'],
    next: '战区首战后，进入结丹争道：冲榜、刷远征积分、优化主力兵种。',
  },
  {
    id: 'endgame',
    dayRange: 'D30+',
    title: '结丹争道',
    subtitle: '没有终点，只有更高的地图收益和赛季排名',
    why: '后期目标不再是“把按钮点完”，而是围绕赛季积分、战区据点、兵种专精和结丹突破做取舍，形成每天不同的出征计划。',
    questIds: ['expedition100', 'power100k', 'stage30', 'realm10'],
    routines: ['查看个人榜与宗门榜，决定今天争据点还是刷远征', '用灵装淬炼尘和法宝资源集中打造一条主力兵种', '每周领取远征里程碑，赛季奖励不要漏领'],
    next: '新的赛季会刷新地图、路线和榜单，保留养成积累并重新选择战术。',
  },
]

export function journeyDay(startedAt: number, now = Date.now()): number {
  return Math.max(1, Math.floor(Math.max(0, now - startedAt) / 86_400_000) + 1)
}

export function guideQuest(id: string): Quest | undefined {
  return QUESTS.find(quest => quest.id === id)
}

export function chapterProgress(chapter: GuideChapter, state: GameState, derived?: GameDerivedSnapshot): { done: number; claimed: number; total: number } {
  const quests = chapter.questIds.map(guideQuest).filter((quest): quest is Quest => !!quest)
  return {
    done: quests.filter(quest => derived?.questDetails[quest.id]?.done ?? quest.done(state)).length,
    claimed: quests.filter(quest => derived?.questDetails[quest.id]?.claimed ?? state.claimedQuests.includes(quest.id)).length,
    total: quests.length,
  }
}

export function isChapterComplete(chapter: GuideChapter, state: GameState, derived?: GameDerivedSnapshot): boolean {
  const progress = chapterProgress(chapter, state, derived)
  return progress.total > 0 && progress.claimed >= progress.total
}

export function currentGuide(state: GameState, now = Date.now(), derived?: GameDerivedSnapshot): {
  chapter: GuideChapter
  objective: Quest | null
  progress: { done: number; claimed: number; total: number }
  day: number
} {
  const chapter = GUIDE_CHAPTERS.find(item => !isChapterComplete(item, state, derived)) ?? GUIDE_CHAPTERS[GUIDE_CHAPTERS.length - 1]
  const objective = chapter.questIds
    .map(guideQuest)
    .find((quest): quest is Quest => !!quest && !(derived?.questDetails[quest.id]?.claimed ?? state.claimedQuests.includes(quest.id))) ?? null
  return { chapter, objective, progress: chapterProgress(chapter, state, derived), day: journeyDay(state.journeyStartedAt, now) }
}
