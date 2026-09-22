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
    id: 'intro-seek',
    target: '.seek-quick-button',
    pose: 'point',
    text: '右下这枚寻道印记，是你每天主动变强的入口。先点一下：它会随机带来修为、灵材或灵装，机缘越足，品质越好。',
    advance: 'click',
    pad: 5,
  },
  {
    id: 'seek-result',
    target: null,
    pose: 'normal',
    text: '看到掉落了吗？修为填满境界条，灵材推动建造，灵装会自动比较并换上更强的一件。之后每次上线，先把寻道次数用掉。',
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
 * 每段控制在 2~3 步，复用同一套孔洞追踪/对话框定位逻辑，
 * 只是脚本来源从 TUTORIAL 换成这里按 id 取。
 */
export type FeatureId =
  | 'yanwu' | 'stage' | 'expedition' | 'cultivator'
  | 'warfront' | 'sect' | 'cangjing' | 'liandan' | 'lianqi' | 'seek'

export const FEATURE_INTRO: Record<FeatureId, TutorialStep[]> = {
  yanwu: [
    {
      id: 'yanwu-1', target: null, pose: 'point', advance: 'next',
      text: '演武场建成了。这里不是单纯加数字：你要训练三种兵种，按敌方构成选择克制关系，才能把有限统兵名额换成更高战力。',
    },
    {
      id: 'yanwu-2', target: null, pose: 'point', advance: 'next',
      text: '先补足兵库，再去秘境。每次出战都会有兵损，留一部分兵做后备，失败后能快速补回，不必从头等资源。',
    },
    {
      id: 'yanwu-3', target: '.practice-tabs', pose: 'point', advance: 'next', pad: 3,
      text: '历练里的四个页签分别负责练兵、推图、远征和修士养成；它们是一条备战链，不是四个互不相干的按钮。',
    },
  ],
  stage: [
    {
      id: 'stage-1', target: null, pose: 'point', advance: 'next',
      text: '秘境是主线推图。每关先看敌方兵种，再决定编队；同样数量的兵，克制关系能让有效战力明显变化。',
    },
    {
      id: 'stage-2', target: null, pose: 'point', advance: 'next',
      text: '点挑战后不会立刻开打，会先进入编队确认。这里可以一键择优，也能手动调整；确认后才支付这次出战的兵损风险。',
    },
    {
      id: 'stage-3', target: null, pose: 'point', advance: 'next',
      text: '若失败，关卡不推进、首通奖励不发，但部众会受损。正确做法是补兵、升养成或换克制，不要拿残军连续撞墙。',
    },
  ],
  expedition: [
    {
      id: 'expedition-1', target: null, pose: 'point', advance: 'next',
      text: '天机远征是每日行动令玩法：五层路线每天轮换，路线选择会改变收益、风险和最终远征积分。',
    },
    {
      id: 'expedition-2', target: null, pose: 'point', advance: 'next',
      text: '稳妥路线更容易推进，风险路线有更高收益但可能失败并损兵；失败会消耗行动令，当前层不会前进，所以先看战力再赌。',
    },
    {
      id: 'expedition-3', target: null, pose: 'point', advance: 'next',
      text: '远征积分不是一次性奖励：它连接周里程碑、28 天游历和遗物商店。每天把恢复的令用掉，后期就不会不知道上线做什么。',
    },
  ],
  cultivator: [
    {
      id: 'cultivator-1', target: null, pose: 'point', advance: 'next',
      text: '秘境中招募到的修士都在这里培养。每人专精一种部众，练度越高，对应部众战力越强。',
    },
    {
      id: 'cultivator-2', target: null, pose: 'point', advance: 'next',
      text: '不要平均分资源：先培养你准备长期带进秘境和战区的主力兵种，其他修士等资源宽裕再补。',
    },
  ],
  warfront: [
    {
      id: 'warfront-1', target: null, pose: 'point', advance: 'next',
      text: '这是苍梧战区——所有修士共享的实时地图。先点据点看守军、产出和归属，再决定今天抢点还是支援同宗。',
    },
    {
      id: 'warfront-2', target: '.warfront-command-bar', pose: 'point', advance: 'next', pad: 4,
      text: '选中据点后在这里调兵遣将。战争令有限，行军途中所有玩家都能看到你的部队动向；战力不足就先回秘境补兵。',
    },
    {
      id: 'warfront-3', target: null, pose: 'point', advance: 'next',
      text: '占领后别急着离开：展开指挥栏直接派援军驻防，再打开好友面板添加在线修士。占点、守点、协同，才是完整的战区循环。',
    },
  ],
  sect: [
    {
      id: 'sect-1', target: null, pose: 'point', advance: 'next',
      text: '宗门大殿建成，道友们可合力围猎结丹期凶兽。独木难成林，人多好办事；妖兽刷新后参与一次，就能拿到协作奖励。',
    },
    {
      id: 'sect-2', target: null, pose: 'point', advance: 'next',
      text: '宗门不是只领一次奖励：合围有冷却，建造队列和后续宗门协同都会围绕你的上线频率产生价值。',
    },
  ],
  cangjing: [
    {
      id: 'cangjing-1', target: null, pose: 'point', advance: 'next',
      text: '藏经阁参研功法，同一时间只能研习一门，效果永久生效。采集、营造、攻伐的选择，会决定你这段时间的发育方向。',
    },
    {
      id: 'cangjing-2', target: null, pose: 'point', advance: 'next',
      text: '离开前确认研究队列已经开动。功法是离线也持续生效的长期投资，越早开始越不浪费 30 天周期。',
    },
  ],
  liandan: [
    {
      id: 'liandan-1', target: null, pose: 'point', advance: 'next',
      text: '炼丹房炼的是限时增益，炼好了记得服用。资源紧张时用产出丹，准备出征时用战力丹，不同时间做不同选择。',
    },
    {
      id: 'liandan-2', target: null, pose: 'point', advance: 'next',
      text: '炼制需要时间，适合下线前开炉、上线后收取服用；它不是一次性点击，而是你的日常时间表。',
    },
  ],
  lianqi: [
    {
      id: 'lianqi-1', target: null, pose: 'point', advance: 'next',
      text: '炼器阁锻造的法宝专精特定部众，配合你的主力兵种来选。你常用哪种克制阵容，就先强化哪件法宝。',
    },
    {
      id: 'lianqi-2', target: null, pose: 'point', advance: 'next',
      text: '寻道重复掉落会转成炼器尘，尘可以淬炼灵装；寻道、法宝和兵种养成会互相喂养，不要把重复掉落当成废品。',
    },
  ],
  seek: [
    {
      id: 'seek-1', target: '.seek-quick-button', pose: 'point', advance: 'next', pad: 4,
      text: '这颗印记常驻洞府，点一下就能寻道，随机得修为、四类灵材和灵装。机缘足时高品质概率更高。',
    },
    {
      id: 'seek-2', target: null, pose: 'point', advance: 'next',
      text: '机缘耗尽不会把主线锁死：按钮会变成静心，仍给稳定修为。你可以在每天机缘恢复后再追求高品质掉落。',
    },
    {
      id: 'seek-3', target: null, pose: 'point', advance: 'next',
      text: '修为条满只是突破的一半，还要准备资源和洞府等级。寻道负责主动推进，建筑负责持续供给，两条线要一起走。',
    },
  ],
}

const buildGuide = (id: string, name: string): TutorialStep[] => [
  {
    id: `${id}-open`, target: '[data-tut="upgrade-btn"]', pose: 'point', advance: 'click', pad: 4,
    text: `先做这一步：在「${name}」面板点击兴建或升级。它是后续玩法的入口，完成后才会持续产生新的收益。`,
  },
  {
    id: `${id}-why`, target: null, pose: 'normal', advance: 'next',
    text: '建造会占用队列并消耗资源。按钮点下后就算开始，完成前可以先去寻道、练兵或处理其他队列，回来再收取结果。',
  },
]

const stageGuide = (id: string, target: string): TutorialStep[] => [
  {
    id: `${id}-tab`, target: '[data-tut="practice-stage"]', pose: 'point', advance: 'click', pad: 3,
    text: '先进入秘境。这里是主线推图入口，关卡奖励会反过来解锁修士和中期养成。',
  },
  {
    id: `${id}-challenge`, target: '[data-tut="stage-challenge"]', pose: 'point', advance: 'click', pad: 4,
    text: '点击当前唯一开放的关卡。每次挑战前先看敌方兵种，别把部队直接撞进克制关系里。',
  },
  {
    id: `${id}-confirm`, target: '[data-tut="stage-challenge-confirm"]', pose: 'point', advance: 'click', pad: 4,
    text: `确认出战 ${target}。按钮点下才会结算战斗，胜利推进关卡，失败只损兵、不发首通奖励。`,
  },
  {
    id: `${id}-after`, target: null, pose: 'normal', advance: 'next',
    text: '战报里先看兵损和胜负，再决定下一关还是回演武补兵。连续失败时优先换克制兵种，不要只堆数量。',
  },
]

const expeditionGuide = (id: string): TutorialStep[] => [
  {
    id: `${id}-tab`, target: '[data-tut="practice-expedition"]', pose: 'point', advance: 'click', pad: 3,
    text: '进入天机远征。远征令会恢复，每天的路线和首领积分都是长期目标，不要把它当成一次性副本。',
  },
  {
    id: `${id}-node`, target: '[data-tut="expedition-node"]', pose: 'point', advance: 'click', pad: 5, shape: 'circle',
    text: '先选当前层的一条路线。稳妥推进保进度，压榨路线奖励更高但失败会损兵，第一次建议先走稳妥。',
  },
  {
    id: `${id}-enter`, target: '[data-tut="expedition-enter"]', pose: 'point', advance: 'click', pad: 4,
    text: '最后点击出征确认。行动令会在这里消耗，战斗演出结束后才会把积分、资源和路线结果发给你。',
  },
  {
    id: `${id}-after`, target: null, pose: 'normal', advance: 'next',
    text: '失败不会推进当前层，但会留下真实兵损和行动令消耗。记住路线选择、补兵和远征积分，组成每天的三步循环。',
  },
]

/** 道途指南任务的阻断式操作教程；只保存于内存，任务进度仍以权威状态判断。 */
export const GUIDE_TOURS: Record<string, TutorialStep[]> = {
  dongfu3: buildGuide('dongfu3', '洞府'),
  producers3: [
    {
      id: 'producers3-open', target: '[data-tut="juling"]', pose: 'point', advance: 'click', pad: 5,
      text: '先从聚灵阵开始。产出建筑不是装饰，它决定你每天能攒出多少升级资源。',
    },
    {
      id: 'producers3-repeat', target: null, pose: 'normal', advance: 'next',
      text: '接下来按同样方法把灵田、矿脉、坊市也升到目标等级：四种资源各有出口，短板会拖慢整个洞府。',
    },
  ],
  seek10: [
    {
      id: 'seek10-click', target: '.seek-quick-button', pose: 'point', advance: 'click', pad: 5,
      text: '先点一次寻道。每次会随机掉落修为、灵材或灵装；这是每天上线最稳定的主动成长按钮。',
    },
    {
      id: 'seek10-repeat', target: '.seek-quick-button', pose: 'point', advance: 'click', pad: 5,
      text: '再点一次确认循环。继续点到任务进度达到 10 次，机缘耗尽后按钮会变成静心，仍然能给稳定修为。',
    },
    {
      id: 'seek10-after', target: null, pose: 'normal', advance: 'next',
      text: '修为推动境界突破，灵材推动建筑和养成，重复灵装还会转成炼器尘。寻道不是孤立抽奖，而是整条成长链的起点。',
    },
  ],
  realm2: [
    {
      id: 'realm2-open', target: '[data-tut="breakthrough-btn"]', pose: 'point', advance: 'click', pad: 4,
      text: '点击顶部突破，先打开境界面板查看缺口。境界同时提高产出和全军战力，是所有玩法共用的成长乘区。',
    },
    {
      id: 'realm2-after', target: null, pose: 'normal', advance: 'next',
      text: '修为、洞府等级和四类资源都满足后再确认突破；若现在还不能突破，就按面板列出的缺口逐项补齐。',
    },
  ],
  yanwu: buildGuide('yanwu', '演武场'),
  troops50: [
    {
      id: 'troops50-tab', target: '[data-tut="practice-army"]', pose: 'point', advance: 'click', pad: 3,
      text: '进入演武。先把兵库补起来，秘境和战区都会产生兵损，没有后备兵就无法连续作战。',
    },
    {
      id: 'troops50-train', target: '[data-tut="train-troop"]', pose: 'point', advance: 'click', pad: 4,
      text: '点击训练一支傀儡兵。实际出战时会受统兵上限限制，所以兵库数量和编队选择要分开考虑。',
    },
    {
      id: 'troops50-after', target: null, pose: 'normal', advance: 'next',
      text: '继续训练到任务要求的 50 名部众，再切到秘境看敌方兵种，优先训练能克制下一关的兵种。',
    },
  ],
  stage5: stageGuide('stage5', '当前关卡'),
  stage10: stageGuide('stage10', '当前关卡'),
  cangjing: buildGuide('cangjing', '藏经阁'),
  gongfa1: [
    {
      id: 'gongfa1-research', target: '[data-tut="gongfa-research"]', pose: 'point', advance: 'click', pad: 4,
      text: '选一门功法开始参研。功法是永久增益，采集、营造、攻伐三条路线决定你这一阶段的发育方向。',
    },
    {
      id: 'gongfa1-after', target: null, pose: 'normal', advance: 'next',
      text: '研究会占用时间，但离线也持续推进。离开前确认队列已经开动，别让藏经阁空转。',
    },
  ],
  liandan: buildGuide('liandan', '炼丹房'),
  lianqi: buildGuide('lianqi', '炼器阁'),
  artifact1: [
    {
      id: 'artifact1-forge', target: '[data-tut="artifact-forge"]', pose: 'point', advance: 'click', pad: 4,
      text: '锻造第一件法宝。法宝要配合主力兵种选择，能把克制编队的优势再放大一层。',
    },
    {
      id: 'artifact1-after', target: null, pose: 'normal', advance: 'next',
      text: '法宝、功法和修士都是永久乘区；寻道重复掉落的炼器尘还可以继续淬炼灵装。',
    },
  ],
  realm6: [
    {
      id: 'realm6-open', target: '[data-tut="breakthrough-btn"]', pose: 'point', advance: 'click', pad: 4,
      text: '再次打开境界突破。筑基是中期分水岭，会提高产出和战力，并把宗门玩法推到你的主循环里。',
    },
    {
      id: 'realm6-after', target: null, pose: 'normal', advance: 'next',
      text: '现在看清楚突破缺口：先保持寻道修为，再让洞府和灵气资源同步增长，别只升级一条线。',
    },
  ],
  zongmen: buildGuide('zongmen', '宗门大殿'),
  boss: [
    {
      id: 'boss-challenge', target: '[data-tut="boss-challenge"]', pose: 'point', advance: 'click', pad: 4,
      text: '发起一次合围妖兽。这里不要求你单人打穿，系统会把同门协作伤害一起结算，按伤害档位发放奖励。',
    },
    {
      id: 'boss-after', target: null, pose: 'normal', advance: 'next',
      text: '合围有冷却，参与后记得看战报和奖励档位。它是低风险的协作日常，不要等到后期才第一次参加。',
    },
  ],
  expedition10: expeditionGuide('expedition10'),
  stage20: stageGuide('stage20', '当前关卡'),
  'warfront-march': [
    {
      id: 'warfront-march-open', target: '.warfront-command-toggle', pose: 'point', advance: 'click', pad: 4,
      text: '先展开地图指挥栏。战区不是点一下领奖，而是侦察据点、配置编队、派出行军，等待抵达后结算。',
    },
    {
      id: 'warfront-march-send', target: '.warfront-march-button', pose: 'point', advance: 'click', pad: 4,
      text: '确认派出行军。战争令会消耗，行军路线和目标会被其他在线玩家看到，兵力不足时先回秘境补兵。',
    },
    {
      id: 'warfront-march-after', target: null, pose: 'normal', advance: 'next',
      text: '行军抵达后才会真正交战；胜利占点拿持续收益，失败会产生兵损并进入整备。地图上的移动本身就是战区博弈的一部分。',
    },
  ],
  'warfront-garrison': [
    {
      id: 'warfront-garrison-command', target: '.warfront-command-toggle', pose: 'point', advance: 'click', pad: 4,
      text: '先选中绿色的我方据点，再展开地图指挥栏。占领不是终点，驻防援军才会把兵力变成真实守军，保护持续收益。',
    },
    {
      id: 'warfront-garrison-after', target: '[data-tut="garrison-panel"]', pose: 'point', advance: 'next', pad: 4,
      text: '这里就是驻防援军操作区：滑动分配兵力，点击“派遣援军”后，其他玩家看到的真实守军会立即增加。',
    },
  ],
  friend: [
    {
      id: 'friend-open', target: '[data-tut="warfront-friends"]', pose: 'point', advance: 'click', pad: 4,
      text: '打开好友面板。这里能看到当前在线的修士、宗门、战功和地图行军状态。',
    },
    {
      id: 'friend-refresh', target: '.friend-refresh', pose: 'point', advance: 'click', pad: 4,
      text: '先刷新在线名单，再直接点击在线玩家的“加为好友”。加好友后才能更快判断谁能协同抢点。',
    },
    {
      id: 'friend-after', target: null, pose: 'normal', advance: 'next',
      text: '好友申请发出后，面板会显示等待回应；对方同意或你同意申请，任务就会完成。',
    },
  ],
  realm9: [
    {
      id: 'realm9-open', target: '[data-tut="breakthrough-btn"]', pose: 'point', advance: 'click', pad: 4,
      text: '打开结丹前的突破检查。后期境界会抬高产出和战力乘区，是争夺高价值据点的长期门槛。',
    },
    {
      id: 'realm9-after', target: null, pose: 'normal', advance: 'next',
      text: '如果缺修为，就回到主城持续寻道；如果缺资源，就收取产出并维持建造队列，突破要靠多条线一起推进。',
    },
  ],
  expedition100: expeditionGuide('expedition100'),
  power100k: [
    {
      id: 'power100k-army', target: '[data-tut="practice-army"]', pose: 'point', advance: 'click', pad: 3,
      text: '先回演武看兵种和兵力。战力底盘来自兵种数量，但真正的效率来自克制、法宝和修士专精。',
    },
    {
      id: 'power100k-cultivator', target: '[data-tut="practice-cultivator"]', pose: 'point', advance: 'click', pad: 3,
      text: '再看修士养成。优先提升与你主力兵种对应的修士，不要把有限资源平均撒在所有人身上。',
    },
    {
      id: 'power100k-level', target: '[data-tut="cultivator-level"]', pose: 'point', advance: 'click', pad: 4,
      text: '点击一次提升，确认一条完整的战力成长链。随后再用功法、法宝和境界把乘区继续叠起来。',
    },
  ],
  stage30: stageGuide('stage30', '当前关卡'),
  realm10: [
    {
      id: 'realm10-open', target: '[data-tut="breakthrough-btn"]', pose: 'point', advance: 'click', pad: 4,
      text: '打开当前版本后期突破。这里不是教程终点，而是决定你今天刷远征、争据点还是继续养主力的分岔点。',
    },
    {
      id: 'realm10-after', target: null, pose: 'normal', advance: 'next',
      text: '完成突破后继续按“收资源—寻道—远征—战区—补兵”的顺序上线，每天做取舍，才会有真正的后期节奏。',
    },
  ],
}

/**
 * 引导 NPC 名号。
 * ⚠️ 原著角色占位，与修士名册里的同名角色是同一人（后期可招募，叙事上说得通）。
 * 按 README 决策1，对外发布前须连同立绘一并替换为原创角色。
 */
export const GUIDE_NAME = '南宫婉'
