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
    text: '底下几处：历练练兵、战区对垒、宗门议事。眼下尚未全部开启，待你洞府有了品阶自会解禁——到时我再与你细说。',
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
 * ═══ 功能解锁分段引导 ═══
 *
 * 开局的 TUTORIAL 只讲「不教就不会」的最初几步，后面十来个系统
 * （演武/秘境/远征/修士/战区/宗门/藏经阁/炼丹房/炼器阁/寻道）
 * 全部留到玩家真正解锁、第一次点进对应面板时才各自讲一遍，
 * 而不是开局一口气塞给他。像加好友、宗门创建/加入这类通用交互
 * （按钮文字已经自解释）不需要单独写一段。
 *
 * 每段都很短（1~2 步），复用同一套孔洞追踪/对话框定位逻辑，
 * 只是脚本来源从 TUTORIAL 换成这里按 id 取。
 */
export type FeatureId =
  | 'yanwu' | 'stage' | 'expedition' | 'cultivator'
  | 'warfront' | 'sect' | 'cangjing' | 'liandan' | 'lianqi' | 'seek'

export const FEATURE_INTRO: Record<FeatureId, TutorialStep[]> = {
  yanwu: [
    {
      id: 'yanwu-1', target: null, pose: 'point', advance: 'next',
      text: '演武场建成了。在此操练部众、扩充兵力——练出的人手会计入统兵上限，多多益善。',
    },
  ],
  stage: [
    {
      id: 'stage-1', target: null, pose: 'point', advance: 'next',
      text: '秘境按章推进，一关一关地打。若战力不足，未必是兵少，先看看编队克制对不对。',
    },
  ],
  expedition: [
    {
      id: 'expedition-1', target: null, pose: 'point', advance: 'next',
      text: '天机远征每日换图，远征令有限。稳妥推进兵损低，压榨路线收益更高但更险，量力而行。',
    },
  ],
  cultivator: [
    {
      id: 'cultivator-1', target: null, pose: 'point', advance: 'next',
      text: '秘境中招募到的修士都在这里培养。每人专精一种部众，练度越高，对应部众战力越强。',
    },
  ],
  warfront: [
    {
      id: 'warfront-1', target: null, pose: 'point', advance: 'next',
      text: '这是苍梧战区——所有修士共享的战场。占据点、抢资源、宗门互保，一举一动旁人都看得见。',
    },
    {
      id: 'warfront-2', target: '.warfront-command-bar', pose: 'point', advance: 'next', pad: 4,
      text: '选中据点后在这里调兵遣将。行军途中，其余玩家也能看到你的部队动向，小心埋伏。',
    },
  ],
  sect: [
    {
      id: 'sect-1', target: null, pose: 'point', advance: 'next',
      text: '宗门大殿建成，道友们可合力围猎结丹期凶兽。独木难成林，人多好办事。',
    },
  ],
  cangjing: [
    {
      id: 'cangjing-1', target: null, pose: 'point', advance: 'next',
      text: '藏经阁参研功法，同一时间只能研习一门，效果是永久的，选之前想清楚。',
    },
  ],
  liandan: [
    {
      id: 'liandan-1', target: null, pose: 'point', advance: 'next',
      text: '炼丹房炼的是限时增益，炼好了记得服用，放着不用等于白炼。',
    },
  ],
  lianqi: [
    {
      id: 'lianqi-1', target: null, pose: 'point', advance: 'next',
      text: '炼器阁锻造的法宝专精克制特定部众，配合你的主力兵种来选，别乱点。',
    },
  ],
  seek: [
    {
      id: 'seek-1', target: '.seek-quick-button', pose: 'point', advance: 'next', pad: 4,
      text: '这颗印记常驻洞府，点一下就能寻道，随机得修为和灵装。机缘攒满时收益最高，别浪费。',
    },
  ],
}

/**
 * 引导 NPC 名号。
 * ⚠️ 原著角色占位，与修士名册里的同名角色是同一人（后期可招募，叙事上说得通）。
 * 按 README 决策1，对外发布前须连同立绘一并替换为原创角色。
 */
export const GUIDE_NAME = '南宫婉'
