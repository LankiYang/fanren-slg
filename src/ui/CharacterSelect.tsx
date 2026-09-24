import { useState } from 'react'
import type { Gender } from '../game/types'
import { useGame } from '../game/store'
import { characterName, characterSubtitle } from '../game/seek'
import { sprite } from './util'

export function CharacterSelect() {
  const gender = useGame(s => s.character.gender)
  const chooseGender = useGame(s => s.chooseGender)
  const connectionError = useGame(s => s.connectionError)
  const [selected, setSelected] = useState<Gender>('male')
  const [working, setWorking] = useState(false)
  if (gender !== null) return null

  const confirm = async () => {
    if (working) return
    setWorking(true)
    const result = await chooseGender(selected)
    if (!result.ok) setWorking(false)
  }

  return (
    <div className="character-select-mask" role="dialog" aria-modal="true" aria-labelledby="character-select-title">
      <div className="character-select">
        <div className="character-select-kicker">凡人修仙 · 初入天南</div>
        <h1 id="character-select-title">选择你的修行身</h1>
        <p>身份只改变称谓、立绘与开场旁白。大道无分男女，战力与掉落规则完全一致。</p>
        <div className="character-options">
          {(['male', 'female'] as Gender[]).map(option => (
            <button
              key={option}
              type="button"
              className={'character-option ' + (selected === option ? 'selected ' + option : '')}
              onClick={() => setSelected(option)}
              aria-pressed={selected === option}
              data-testid={`choose-${option}`}
            >
              <div className="character-art-wrap">
                <img
                  src={sprite(option === 'female' ? 'guide/lady-normal.webp' : 'cultivator/hanli.webp')}
                  alt={option === 'female' ? '女修立绘' : '男修立绘'}
                  className="character-art"
                />
              </div>
              <strong>{option === 'female' ? '女修 · ' : '男修 · '}{characterName(option)}</strong>
              <small>{characterSubtitle(option).replace(/^男修 · |^女修 · /, '')}</small>
            </button>
          ))}
        </div>
        {connectionError && <div className="hint" role="alert">{connectionError}</div>}
        <button
          className="btn-main character-confirm"
          type="button"
          onClick={() => void confirm()}
          disabled={working}
        >
          {working ? '入道中…' : '以此身入道'}
        </button>
      </div>
    </div>
  )
}
