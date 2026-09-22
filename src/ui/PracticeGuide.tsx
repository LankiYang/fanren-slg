import type { ReactNode } from 'react'

export type PracticeSection = 'army' | 'stage' | 'expedition' | 'cultivator'

interface PracticeGuideContent {
  label: string
  icon: string
  title: string
  short: string
  why: string
  gain: string
  next: string
  rules: string[]
}

export const PRACTICE_GUIDE: Record<PracticeSection, PracticeGuideContent> = {
  army: {
    label: '演武',
    icon: '⚔',
    title: '练兵与编队',
    short: '所有战斗的底盘',
    why: '先训练部队，再按敌方兵种安排出战。统兵名额有限，带上克制兵种，往往比盲目堆数量更有效。',
    gain: '部队数量、统兵上限、克制战力',
    next: '去秘境看下一关的敌阵，再点一键择优。',
    rules: ['傀儡兵克御兽军', '御兽军克符修弓阵', '符修弓阵克傀儡兵'],
  },
  stage: {
    label: '秘境',
    icon: '✦',
    title: '章节推图',
    short: '拿首通资源与修士',
    why: '秘境是验证编队的 PvE 主线。每次胜利推进一关，首通给资源并在关键关解锁修士；失败会损兵，但不会推进。',
    gain: '首通资源、章节进度、修士解锁',
    next: '先补兵，再看敌方构成，确认编队后出战。',
    rules: ['胜利：推进并领取首通奖励', '失败：损兵、不推进、不发首通奖励', '敌方兵种决定本关的克制方向'],
  },
  expedition: {
    label: '远征',
    icon: '⌁',
    title: '每日路线与长期兑换',
    short: '用行动令换远征币和遗物',
    why: '远征不是推图替代品，而是每天做一次路线决策：稳妥路线保兵，压榨路线拿更多积分与奖励，终点首领给当天最高收益。',
    gain: '远征积分、远征币、28 天游历遗物',
    next: '每天先看路线，再决定今天要稳妥拿满进度还是压榨高收益。',
    rules: ['破阵：战斗拿分，可能产生兵损', '采灵/护送：低至中风险资源节点', '天机：随机收益，压榨失败会浪费行动令', '首领：五层终点，最高收益'],
  },
  cultivator: {
    label: '修士',
    icon: '☯',
    title: '主力兵种的永久乘区',
    short: '决定你长期培养哪一套阵容',
    why: '修士不是独立上阵的装饰，而是绑定兵种的长期增益。秘境、远征、战区都会吃到对应专精，优先培养你的主力流派。',
    gain: '对应兵种的永久战力加成',
    next: '先看你最常用的兵种，再把资源投给对应修士。',
    rules: ['傀儡兵：稳守、抗伤，适合谨慎推图', '御兽军：机动、突击，适合护送与奇袭', '符修弓阵：远程爆发，适合利用克制'],
  },
}

const FLOW: PracticeSection[] = ['army', 'stage', 'expedition', 'cultivator']

export function PracticeOverview({ active, onSelect }: { active: PracticeSection; onSelect: (section: PracticeSection) => void }) {
  const content = PRACTICE_GUIDE[active]

  return (
    <section className="practice-overview" aria-label="历练玩法说明">
      <div className="practice-overview-head">
        <div>
          <b>历练 · 先备战，再出征</b>
          <span>每天的主循环：练兵 → 推图 → 取利；修士负责把主力越养越强。</span>
        </div>
        <span className="practice-overview-badge">玩法总览</span>
      </div>

      <div className="practice-loop">
        {FLOW.map((section, index) => {
          const item = PRACTICE_GUIDE[section]
          return (
            <div className="practice-loop-item-wrap" key={section}>
              <button
                type="button"
                className={'practice-loop-item' + (active === section ? ' active' : '')}
                onClick={() => onSelect(section)}
                aria-label={`查看${item.label}用途`}
              >
                <i>{item.icon}</i>
                <b>{item.label}</b>
                <small>{item.short}</small>
              </button>
              {index < FLOW.length - 1 && <span className="practice-loop-arrow" aria-hidden="true">›</span>}
            </div>
          )
        })}
      </div>

      <div className={'practice-current ' + active}>
        <div className="practice-current-title"><span>{content.icon}</span><b>{content.title}</b><em>{content.label}</em></div>
        <p>{content.why}</p>
        <div className="practice-current-meta"><span><b>主要获得</b>{content.gain}</span><span><b>下一步</b>{content.next}</span></div>
      </div>

      <details className="practice-routine">
        <summary>不知道怎么玩？打开每日顺序</summary>
        <div className="practice-routine-rows">
          <div><b>① 演武补兵</b><span>把三类部队练到可出战，查看敌方兵种并保留统兵名额。</span></div>
          <div><b>② 秘境试阵</b><span>优先打当前解锁关卡；失败先补兵、换克制，不要用残军连续硬撞。</span></div>
          <div><b>③ 远征取利</b><span>每天消耗远征令推进路线，远征币在战绩里兑换资源和永久遗物。</span></div>
          <div><b>④ 修士专精</b><span>把秘境解锁的修士升起来，强化对应兵种，反馈到秘境、远征和战区。</span></div>
        </div>
      </details>
    </section>
  )
}

export function PracticePurpose({ section, children }: { section: PracticeSection; children?: ReactNode }) {
  const content = PRACTICE_GUIDE[section]
  return (
    <section className={'practice-purpose ' + section} aria-label={`${content.label}玩法说明`}>
      <div className="practice-purpose-heading">
        <span>{content.icon}</span>
        <div><b>{content.label}：{content.title}</b><small>{content.short}</small></div>
      </div>
      <p>{content.why}</p>
      <div className="practice-purpose-rules">
        {content.rules.map(rule => <span key={rule}>{rule}</span>)}
      </div>
      {children}
    </section>
  )
}
