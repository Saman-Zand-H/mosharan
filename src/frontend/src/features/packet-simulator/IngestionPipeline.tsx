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

interface IngestionPipelineProps {
  failureMessage?: string
  phase: SimulationPhase
}

const steps = [
  {
    title: 'دریافت envelope',
    description: 'نوع رویداد و بایت‌های خام وارد می‌شوند.',
    icon: Inbox,
  },
  {
    title: 'حفظ رویداد خام',
    description: 'یک RAW آزمایشی در حافظهٔ نشست ساخته می‌شود.',
    icon: Database,
  },
  {
    title: 'تطبیق و تجزیه',
    description: 'schema و فیلدهای ذخیره‌شده در پایگاه داده اعمال می‌شوند.',
    icon: FileSearch,
  },
  {
    title: 'ساخت خوانش‌ها',
    description: 'مقادیر رمزگشایی‌شده به خوانش تبدیل می‌شوند.',
    icon: Waypoints,
  },
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

export function IngestionPipeline({ failureMessage, phase }: IngestionPipelineProps) {
  const progress = progressByPhase[phase]
  const liveMessage =
    phase === 'processed'
      ? 'بسته با موفقیت پردازش شد و خوانش‌ها ساخته شدند.'
      : ''

  return (
    <section className="simulator-card pipeline-card" aria-labelledby="pipeline-title">
      <header className="simulator-card__header">
        <div>
          <span className="simulator-kicker">مسیر پردازش</span>
          <h2 id="pipeline-title">از دریافت تا خوانش</h2>
          <p>این مسیر رفتار raw-first سامانه را به‌صورت محلی نمایش می‌دهد.</p>
        </div>
        <span className={`pipeline-state pipeline-state--${phase}`}>
          {phase === 'processed' ? 'تکمیل شد' : phase === 'failed' ? 'نیازمند بررسی' : phase === 'idle' ? 'آماده' : 'در حال اجرا'}
        </span>
      </header>

      <ol className="pipeline-steps">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const failed = phase === 'failed' && stepNumber === 3
          const complete = progress > stepNumber && !failed
          const active = progress === stepNumber && !failed
          const status = failed ? 'failed' : complete ? 'complete' : active ? 'active' : 'pending'
          const Icon = step.icon

          return (
            <li
              className={`pipeline-step pipeline-step--${status}`}
              key={step.title}
              aria-current={active ? 'step' : undefined}
            >
              <span className="pipeline-step__icon">
                {complete ? <Check size={17} aria-hidden="true" /> : failed ? <TriangleAlert size={17} aria-hidden="true" /> : active ? <Icon size={17} aria-hidden="true" /> : <CircleDashed size={17} aria-hidden="true" />}
              </span>
              <div>
                <small>مرحلهٔ {stepNumber.toLocaleString('fa-IR')}</small>
                <strong>{step.title}</strong>
                <p>{failed ? failureMessage : step.description}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </section>
  )
}
