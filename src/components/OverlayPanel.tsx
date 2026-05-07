import type { OverlaySettings, SimState } from '../simulation/types'

interface Props {
  simState:   SimState
  setOverlay: <K extends keyof OverlaySettings>(key: K, value: boolean) => void
  setBallStatic: (v: boolean) => void
}

interface OverlayMeta {
  key:   keyof OverlaySettings
  label: string
  desc:  string
}

const OVERLAYS: OverlayMeta[] = [
  { key: 'showFOVCone',             label: 'Field of View Cone',     desc: 'Vision cone — green when ball is visible, purple when searching' },
  { key: 'showOrientationArrow',    label: 'Target Orientation',     desc: 'Dashed line showing the direction the robot is trying to rotate toward' },
  { key: 'showChaseDistanceCircle', label: 'Chase Distance Circle',  desc: 'Circle around ball marking the chase range threshold' },
  { key: 'showAlignmentLine',       label: 'Alignment Line',         desc: 'Line from robot → ball → goal showing alignment' },
  { key: 'showShootAngleCone',      label: 'Shoot Angle Cone',       desc: 'Angular tolerance cone behind ball for shooting position' },
  { key: 'showTangentVector',       label: 'Tangent Vector',         desc: 'Direction robot is moving during repositioning' },
  { key: 'showRadialVector',        label: 'Radial Vector',          desc: 'Direction robot is closing in during radial adjust' },
  { key: 'showBallVelocity',        label: 'Ball Velocity',          desc: 'Arrow showing ball speed and direction' },
  { key: 'showStateLabel',          label: 'State Label',            desc: 'Current state name shown above robot' },
  { key: 'showContactRange',        label: 'Contact Range Circle',   desc: 'Circle showing the range at which robot can push ball' },
]

export default function OverlayPanel({ simState, setOverlay, setBallStatic }: Props) {
  return (
    <div className="p-3 overflow-y-auto h-full space-y-2">
      {/* Ball mode */}
      <div className="mb-3">
        <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-2">Ball Mode</div>
        <div className="bg-[#0f1117] rounded p-2 flex items-center justify-between">
          <div>
            <div className="text-xs text-[#e2e8f0]">Static Ball</div>
            <div className="text-[10px] text-[#475569] mt-0.5">Ball ignores physics — drag it freely</div>
          </div>
          <button
            onClick={() => setBallStatic(!simState.ball.isStatic)}
            className={`relative w-10 h-5 rounded-full transition-colors ${simState.ball.isStatic ? 'bg-[#7c3aed]' : 'bg-[#1e293b]'}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${simState.ball.isStatic ? 'left-5' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>

      <div className="text-[10px] text-[#475569] uppercase tracking-widest mb-2">Canvas Overlays</div>
      {OVERLAYS.map(({ key, label, desc }) => (
        <div
          key={key}
          className="bg-[#0f1117] rounded p-2 flex items-center gap-3 cursor-pointer hover:bg-[#131820]"
          onClick={() => setOverlay(key, !simState.overlays[key])}
        >
          <div
            className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
              simState.overlays[key]
                ? 'bg-[#3b82f6] border-[#3b82f6]'
                : 'border-[#334155] bg-transparent'
            }`}
          >
            {simState.overlays[key] && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <div className="text-xs text-[#e2e8f0]">{label}</div>
            <div className="text-[10px] text-[#475569] mt-0.5">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
