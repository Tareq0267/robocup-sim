import type { RobotParams, TeamConfig } from '../simulation/types'
import { PARAM_META } from '../simulation/config'

interface Props {
  params:        RobotParams
  team:          TeamConfig
  setParam:      <K extends keyof RobotParams>(key: K, value: RobotParams[K]) => void
  setTeamConfig: <K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) => void
}

function Slider({
  label, value, unit, min, max, step, desc,
  onChange,
}: {
  label: string; value: number; unit: string; min: number; max: number; step: number; desc: string
  onChange: (v: number) => void
}) {
  return (
    <div className="bg-[#0f1117] rounded p-2">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[#e2e8f0] text-xs font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value.toFixed(step < 0.1 ? 2 : 1)}
            min={min} max={max} step={step}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="w-16 text-right bg-[#1a1a2e] border border-[#2a2a3e] rounded px-1 py-0.5 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#3b82f6]"
          />
          <span className="text-[#475569] text-[10px] w-8">{unit}</span>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-blue-500 cursor-pointer"
      />
      <div className="text-[#475569] text-[10px] mt-1 leading-snug">{desc}</div>
    </div>
  )
}

export default function ParameterPanel({ params, team, setParam, setTeamConfig }: Props) {
  return (
    <div className="p-3 overflow-y-auto h-full space-y-3">

      {/* Team settings */}
      <div className="text-[10px] text-[#475569] uppercase tracking-widest">Team</div>
      <Slider
        label="Role Swap Delay" value={team.roleSwapDelay} unit="s"
        min={0.1} max={5} step={0.1}
        desc="Seconds the closer robot must stay closer before roles swap. Resets if distances flip back."
        onChange={v => setTeamConfig('roleSwapDelay', v)}
      />

      {/* Robot settings (shared) */}
      <div className="text-[10px] text-[#475569] uppercase tracking-widest pt-1">
        Robots (shared)
      </div>
      {PARAM_META.map(meta => {
        const isAngle  = meta.unit === 'deg'
        const raw      = params[meta.key] as number
        const disp     = isAngle ? raw * 180 / Math.PI : raw
        const onChange = (v: number) =>
          setParam(meta.key, (isAngle ? v * Math.PI / 180 : v) as RobotParams[typeof meta.key])

        return (
          <Slider
            key={meta.key}
            label={meta.label} value={disp} unit={meta.unit}
            min={meta.min} max={meta.max} step={meta.step}
            desc={meta.desc}
            onChange={onChange}
          />
        )
      })}
    </div>
  )
}
