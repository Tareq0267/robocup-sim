import type { StrategyId, StrategyParams } from '../simulation/types'
import { STRATEGIES, STRATEGY_PARAM_META } from '../simulation/config'
import { Slider } from './ParameterPanel'

interface Props {
  strategy:         StrategyId
  strategyParams:   StrategyParams
  setStrategy:      (id: StrategyId) => void
  setStrategyParam: <K extends keyof StrategyParams>(key: K, value: StrategyParams[K]) => void
}

export default function StrategyPanel({ strategy, strategyParams, setStrategy, setStrategyParam }: Props) {
  const active = STRATEGIES.find(s => s.id === strategy)

  return (
    <div className="p-3 overflow-y-auto h-full space-y-3">
      <div className="text-[10px] text-[#6b7280] uppercase tracking-widest">Strategy</div>

      <select
        value={strategy}
        onChange={e => setStrategy(e.target.value as StrategyId)}
        className="w-full bg-[#0f1117] border border-[#2a2a3e] rounded px-2 py-1.5 text-xs text-[#e2e8f0]
          focus:outline-none focus:border-[#3b82f6] cursor-pointer"
      >
        {STRATEGIES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      {active && (
        <div className="text-[#6b7280] text-[10px] leading-snug">{active.desc}</div>
      )}

      {strategy !== 'none' && (
        <>
          <div className="text-[10px] text-[#34d399] uppercase tracking-widest pt-2 border-t border-[#1e1e1e]">
            Run &amp; Pass Params
          </div>
          {STRATEGY_PARAM_META.map(meta => (
            <Slider
              key={meta.key}
              label={meta.label} value={strategyParams[meta.key]}
              unit={meta.unit} min={meta.min} max={meta.max} step={meta.step} desc={meta.desc}
              accentClass="accent-emerald-500"
              onChange={v => setStrategyParam(meta.key, v)}
            />
          ))}
        </>
      )}
    </div>
  )
}
