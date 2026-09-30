import type { ReactNode } from 'react'
import { statusLabel } from '../lib/format'

export const btn =
  'inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
export const btnPrimary = `${btn} bg-teal-700 text-white hover:bg-teal-800`
export const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`
export const btnDanger = `${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`
export const input =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const color = v >= 100 ? 'bg-emerald-600' : v > 0 ? 'bg-amber-500' : 'bg-slate-300'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${v}%` }} />
    </div>
  )
}

const statusStyle: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[status] ?? statusStyle.not_started}`}>
      {statusLabel[status] ?? status}
    </span>
  )
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>
}

export function Loading() {
  return <div className="py-10 text-center text-sm text-slate-500">Loading…</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Stat({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900'
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  )
}
