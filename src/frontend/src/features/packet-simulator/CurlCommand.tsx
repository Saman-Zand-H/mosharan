import { useMemo, useState } from 'react'
import { Check, Copy, Terminal } from 'lucide-react'

import { buildIngestCurl } from './ingestCurl'
import type { SimulationReceipt } from './simulatorTypes'

function copyViaHiddenTextarea(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const succeeded = document.execCommand('copy')
  textarea.remove()
  return succeeded
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyViaHiddenTextarea(text)
  }
}

export function CurlCommand({ receipt }: { receipt: SimulationReceipt }) {
  const command = useMemo(() => buildIngestCurl(receipt), [receipt])
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!(await copyText(command))) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="curl-command">
      <div className="curl-command__bar">
        <span className="curl-command__title">
          <Terminal size={15} aria-hidden="true" />
          فرمان curl برای ارسال واقعی همین payload
        </span>
        <button type="button" className="curl-command__copy" onClick={() => void copy()}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'کپی شد' : 'کپی'}
        </button>
      </div>
      <pre dir="ltr" className="curl-command__code">
        <code>{command}</code>
      </pre>
      <p className="curl-command__hint">
        شبیه‌ساز چیزی ثبت نمی‌کند؛ این فرمان با جایگزینی توکن درگاه، همان رویداد را به‌صورت واقعی
        در سرور ثبت می‌کند.
      </p>
    </div>
  )
}
