import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MAX_STEERING_DEG } from '../vehicle-scene/vehicle-motion'
import { DEMO_SCENARIOS, type DemoScenario } from './demo-scenarios'
import { useDemo } from './demo-store'

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const view = useDemo((state) => state.view)
  const speed = useDemo((state) => state.speedKph)
  const setSpeed = useDemo((state) => state.setSpeed)
  const scenario = useDemo((state) => state.scenario)
  const setScenario = useDemo((state) => state.setScenario)
  const angle = useDemo((state) => state.steeringDeg)
  const setView = useDemo((state) => state.setView)
  const setSteering = useDemo((state) => state.setSteering)

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            ref={panel}
            id="debug-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="debug-heading"
            tabIndex={-1}
            className="debug-panel"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
          >
            <header className="debug-header">
              <div><h2 id="debug-heading">디버그</h2><p>실차 연결 없이 화면을 확인합니다.</p></div>
              <button type="button" className="debug-close" onClick={close} aria-label="디버그 닫기">×</button>
            </header>
            <div className="debug-section">
              <h3>화면 상태</h3>
              <div className="view-switch" role="group" aria-label="기어 선택">
                <button type="button" aria-pressed={view === 'park'} onClick={() => setView('park')}>주차 P</button>
                <button type="button" aria-pressed={view === 'reverse'} onClick={() => setView('reverse')}>후진 R</button>
                <button type="button" aria-pressed={view === 'neutral'} onClick={() => setView('neutral')}>중립 N</button>
                <button type="button" aria-pressed={view === 'drive'} onClick={() => setView('drive')}>주행 D</button>
              </div>
            </div>
            <div className="debug-section">
              <div className="steering-heading">
                <label htmlFor="steering">조향각</label>
                <output htmlFor="steering">{angle > 0 ? '+' : ''}{angle.toFixed(0)}<span>°</span></output>
                <button type="button" className="reset-button" onClick={() => setSteering(0)}>중앙</button>
              </div>
              <input id="steering" type="range" min={-MAX_STEERING_DEG} max={MAX_STEERING_DEG} step="0.1" value={angle}
                onChange={(event) => setSteering(Number(event.target.value))} aria-valuetext={`${angle}도`} />
              <div className="range-labels"><span>왼쪽</span><span>오른쪽</span></div>
            </div>
            <div className="debug-section">
              <div className="steering-heading">
                <label htmlFor="demo-speed">속도</label>
                <output htmlFor="demo-speed">{speed.toFixed(0)}<span>km/h</span></output>
                <button type="button" className="reset-button" onClick={() => setSpeed(0)}>정지</button>
              </div>
              <input id="demo-speed" type="range" min="0" max="120" step="1" value={speed}
                disabled={view === 'park'} aria-valuetext={`${speed}킬로미터 매 시`}
                onChange={(event) => setSpeed(Number(event.target.value))} />
              {view === 'park' && <p className="debug-note">속도 변경은 R/N/D에서 가능합니다.</p>}
            </div>
            <div className="debug-section">
              <label className="scenario-label" htmlFor="drive-scenario">주행 입력 예시</label>
              <select id="drive-scenario" value={scenario} onChange={(event) => setScenario(event.target.value as DemoScenario)}>
                {Object.entries(DEMO_SCENARIOS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
              </select>
              <p className="scenario-note">선택하면 D로 전환합니다. 속도·RPM·전류 예시로 추정하며, 감속 예시는 속도가 서서히 줄어듭니다. 전류는 +방전/−충전을 가정합니다.</p>
            </div>
            <p className="debug-note">점선은 상대적인 조향 가이드이며 실제 주차 궤적이 아닙니다.</p>
          </motion.aside>
        )}
      </AnimatePresence>
      <button ref={trigger} type="button" className="debug-trigger" aria-label="디버그 열기"
        aria-expanded={open} aria-controls="debug-panel" onClick={() => open ? close() : setOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 7h7m4 0h5M4 17h3m4 0h9" />
          <circle cx="13" cy="7" r="2" /><circle cx="9" cy="17" r="2" />
        </svg>
      </button>
    </>
  )
}
