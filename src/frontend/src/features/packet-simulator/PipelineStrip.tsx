import {
  Check,
  CircleDashed,
  Database,
  FileSearch,
  Inbox,
  TriangleAlert,
  Waypoints,
} from 'lucide-react'

import type { SimulationPhase } from './simulatorTypes'

const steps = [
  { title: 'دریافت', icon: Inbox },
  { title: 'حفظ خام', icon: Database },
  { title: 'تجزیه', icon: FileSearch },
  { title: 'ساخت خوانش', icon: Waypoints },
] as const

const progressByPhase: Record<SimulationPhase, number> = {
  idle: 0,
  receiving: 1,
  stored: 2,
  parsing: 3,
  projecting: 4,
  processed: 5,
  failed: 3,
}

export function PipelineStrip({ phase }: { phase: SimulationPhase }) {
  const progress = progressByPhase[phase]

  return (
    <ol className="pipeline-strip" aria-label="مراحل پردازش payload">
      {steps.map((step, index) => {
        const stepNumber = index + 1
        const failed = phase === 'failed' && stepNumber === 3
        const complete = progress > stepNumber && !failed
        const active = progress === stepNumber && !failed
        const status = failed ? 'failed' : complete ? 'complete' : active ? 'active' : 'pending'
        const Icon = step.icon

        return (
          <li
            className={`pipeline-strip__step pipeline-strip__step--${status}`}
            key={step.title}
            aria-current={active ? 'step' : undefined}
          >
            <span className="pipeline-strip__icon">
              {complete
                ? <Check size={13} aria-hidden="true" />
                : failed
                  ? <TriangleAlert size={13} aria-hidden="true" />
                  : active
                    ? <Icon size={13} aria-hidden="true" />
                    : <CircleDashed size={13} aria-hidden="true" />}
            </span>
            <span>{step.title}</span>
          </li>
        )
      })}
    </ol>
  )
}
