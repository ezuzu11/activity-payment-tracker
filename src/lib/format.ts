const rwf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const money = (n: number | string | null | undefined) => `${rwf.format(Number(n ?? 0))} RWF`

export const pct = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0)
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`
}

export const date = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const today = () => new Date().toISOString().slice(0, 10)

export const floorLabel = (block: string, floor: number) => `Block ${block} · Floor ${floor}`

export const statusLabel: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

const APT_ORDER = ['R', 'M', 'L', 'PH1', 'PH2']
/** Sort apartments in site order: Right, Middle, Left, then penthouses. */
export const aptSort = <T extends { label: string }>(a: T, b: T) => {
  const ia = APT_ORDER.indexOf(a.label), ib = APT_ORDER.indexOf(b.label)
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.label.localeCompare(b.label)
}
