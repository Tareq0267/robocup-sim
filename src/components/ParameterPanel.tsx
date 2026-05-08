import type { RobotParams, TeamConfig, GoalkeeperParams } from '../simulation/types'
import { PARAM_META, ASSIST_PARAM_META, GK_PARAM_META, GK_BLOCK_PARAM_META, KICKOFF_PARAM_META } from '../simulation/config'

interface Props {
  params:        RobotParams
  team:          TeamConfig
  gkParams:      GoalkeeperParams
  setParam:      <K extends keyof RobotParams>(key: K, value: RobotParams[K]) => void
  setTeamConfig: <K extends keyof TeamConfig>(key: K, value: TeamConfig[K]) => void
  setGKParam:    <K extends keyof GoalkeeperParams>(key: K, value: GoalkeeperParams[K]) => void
}

function Slider({
  label, value, unit, min, max, step, desc, accentClass = 'accent-blue-500',
  onChange,
}: {
  label: string; value: number; unit: string; min: number; max: number; step: number; desc: string
  accentClass?: string
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
        className={`w-full h-1 ${accentClass} cursor-pointer`}
      />
      <div className="text-[#475569] text-[10px] mt-1 leading-snug">{desc}</div>
    </div>
  )
}

export default function ParameterPanel({ params, team, gkParams, setParam, setTeamConfig, setGKParam }: Props) {
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

      {/* Striker settings (shared P1/P2) */}
      <div className="text-[10px] text-[#475569] uppercase tracking-widest pt-1">
        Strikers (P1 &amp; P2)
      </div>
      {PARAM_META.map(meta => {
        const isAngle  = meta.unit === 'deg'
        const raw      = params[meta.key] as number
        const disp     = isAngle ? raw * 180 / Math.PI : raw
        const onChange = (v: number) =>
          setParam(meta.key, (isAngle ? v * Math.PI / 180 : v) as RobotParams[typeof meta.key])
        return (
          <Slider key={meta.key} label={meta.label} value={disp} unit={meta.unit}
            min={meta.min} max={meta.max} step={meta.step} desc={meta.desc}
            onChange={onChange}
          />
        )
      })}

      {/* Assist settings */}
      <div className="text-[10px] text-[#34d399] uppercase tracking-widest pt-2 border-t border-[#1e1e1e]">
        Assist
      </div>
      {ASSIST_PARAM_META.map(meta => (
        <Slider key={meta.key} label={meta.label} value={params[meta.key] as number}
          unit={meta.unit} min={meta.min} max={meta.max} step={meta.step} desc={meta.desc}
          accentClass="accent-emerald-500"
          onChange={v => setParam(meta.key, v as RobotParams[typeof meta.key])}
        />
      ))}

      {/* Goalkeeper settings */}
      <div className="text-[10px] text-[#f97316] uppercase tracking-widest pt-2 border-t border-[#1e1e1e]">
        Goalkeeper
      </div>
      {GK_PARAM_META.map(meta => {
        const isAngle  = meta.unit === 'deg'
        const raw      = gkParams[meta.key] as number
        const disp     = isAngle ? raw * 180 / Math.PI : raw
        const onChange = (v: number) =>
          setGKParam(meta.key, (isAngle ? v * Math.PI / 180 : v) as GoalkeeperParams[typeof meta.key])
        return (
          <Slider key={meta.key} label={meta.label} value={disp} unit={meta.unit}
            min={meta.min} max={meta.max} step={meta.step} desc={meta.desc}
            accentClass="accent-orange-500"
            onChange={onChange}
          />
        )
      })}

      {/* Adjust Block settings */}
      <div className="text-[10px] text-[#fbbf24] uppercase tracking-widest pt-2 border-t border-[#1e1e1e]">
        GK — Adjust Block
      </div>
      {GK_BLOCK_PARAM_META.map(meta => (
        <Slider key={meta.key} label={meta.label} value={gkParams[meta.key] as number}
          unit={meta.unit} min={meta.min} max={meta.max} step={meta.step} desc={meta.desc}
          accentClass="accent-amber-500"
          onChange={v => setGKParam(meta.key, v as GoalkeeperParams[typeof meta.key])}
        />
      ))}

      {/* Kickoff positions */}
      <div className="text-[10px] text-[#818cf8] uppercase tracking-widest pt-2 border-t border-[#1e1e1e]">
        Kickoff Positions
      </div>
      {KICKOFF_PARAM_META.map(meta => (
        <Slider key={meta.key} label={meta.label} value={team[meta.key] as number}
          unit={meta.unit} min={meta.min} max={meta.max} step={meta.step} desc={meta.desc}
          accentClass="accent-indigo-500"
          onChange={v => setTeamConfig(meta.key, v as TeamConfig[typeof meta.key])}
        />
      ))}
    </div>
  )
}
