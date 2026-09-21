// ═══ 新手引导流程定义 ═══
//
// 阻断式引导：屏幕被四块遮罩围住，只留一个「孔洞」露出目标元素，
// 玩家只能点那一处，点完才进下一步。
//
// 为什么用阻断式而不是提示式：
// SLG 的首屏信息量很大（10 座建筑 + 5 个页签 + 资源条 + 任务追踪器），
// 新玩家不知道先点哪里就会流失。阻断式把第一分钟压缩成一条唯一路径。
// 代价是打断感强，所以步数必须克制 —— 只覆盖「不教就不会」的操作，
// 能自己摸索出来的（比如底栏切页签）用一句话带过，不设强制点击。

export interface TutorialStep {
  id: string
  /** 高亮目标的 CSS 选择器；null = 纯对话，不挖洞 */
  target: string | null
  /** 立绘姿态 */
  pose: 'normal' | 'point'
  /** 对话文本 */
  text: string
  /**
   * 推进方式：
   *   'click'  玩家点中高亮目标才推进
   *   'next'   点任意处（或"继续"按钮）推进
   *   'watch'  等待 condition 返回 true 自动推进（用于等建造完成这类）
   */
  advance: 'click' | 'next' | 'watch'
  /** advance='watch' 时的完成条件 */
  condition?: (s: TutorialContext) => boolean
  /** 孔洞额外内边距（像素），给不规则元素留余量 */
  pad?: number
  /** 孔洞形状：建筑用圆形更贴合，按钮/条用圆角矩形 */
  shape?: 'rect' | 'circle'
}

/** 引导判断条件需要的游戏状态切片 */
export interface TutorialContext {
  dongfuLevel: number
  producerMaxLevel: number
  realm: number
  troops: number
  clearedStage: number
  isUpgrading: boolean
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'welcome',
    target: null,
    pose: 'normal',
    text: '道友且住。此地灵气驳杂，你既要在此开辟洞府，有几处关窍，我先与你说明白。',
    advance: 'next',
  },
  {
    id: 'intro-resources',
    target: '.topbar',
    pose: 'point',
    text: '先看顶上这四样——灵石、灵气、灵药、矿灵材，皆由下方各处自行产出。仓廪有限，满了便不再进项，记得常来取用。',
    advance: 'next',
    pad: 4,
  },
  {
    id: 'click-dongfu',
    target: '[data-tut="dongfu"]',
    pose: 'point',
    text: '这是洞府，你安身立命之所。它的品阶压着其余各处的上限——点开看看。',
    advance: 'click',
    pad: 6,
    shape: 'circle',
  },
  {
    id: 'upgrade-dongfu',
    target: '[data-tut="upgrade-btn"]',
    pose: 'point',
    text: '兴建要耗资材，也须费些时辰。点下去，洞府便可拔高一层。',
    advance: 'click',
    pad: 4,
  },
  {
    id: 'wait-build',
    target: null,
    pose: 'normal',
    text: '好。营造需时，你尽可去忙别的，时辰到了自会完工。',
    advance: 'next',
  },
  {
    id: 'intro-quest',
    target: '.quest-track',
    pose: 'point',
    text: '若一时不知该做什么，看这里就是。我已替你把该走的路一步步列好，照着做便不会走岔。',
    advance: 'next',
    pad: 5,
  },
  {
    id: 'intro-tabs',
    target: '.tabbar',
    pose: 'point',
    text: '底下五处：演武场练兵、秘境历练、修士调度、宗门议事。眼下尚未开启，待你洞府有了品阶自会解禁。',
    advance: 'next',
    pad: 2,
  },
  {
    id: 'done',
    target: null,
    pose: 'normal',
    text: '言尽于此。修行一途讲究稳扎稳打——你且去吧，来日方长。',
    advance: 'next',
  },
]

/**
 * 引导 NPC 名号。
 * ⚠️ 原著角色占位，与修士名册里的同名角色是同一人（后期可招募，叙事上说得通）。
 * 按 README 决策1，对外发布前须连同立绘一并替换为原创角色。
 */
export const GUIDE_NAME = '南宫婉'
