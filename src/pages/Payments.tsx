import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import type { PaymentView, WorkOrderView } from '../lib/types'
import { date, money, pct } from '../lib/format'
import { btnGhost, Card, Empty, ErrorBox, input, Loading, PageTitle, Stat, Field } from '../components/ui'

type Row = PaymentView & { wo?: WorkOrderView }

export default function Payments() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [block, setBlock] = useState('')
  const [activity, setActivity] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('v_payments').select('*').order('paid_on', { ascending: false }).order('id', { ascending: false }),
      supabase.from('v_work_orders').select('*'),
    ]).then(([p, w]) => {
      const err = p.error ?? w.error
      if (err) setError(friendlyError(err))
      const byId = new Map(((w.data as WorkOrderView[]) ?? []).map((x) => [x.id, x]))
      setRows(((p.data as PaymentView[]) ?? []).map((x) => ({ ...x, wo: byId.get(x.work_order_id) })))
    })
  }, [])

  const activities = useMemo(() => [...new Set((rows ?? []).map((r) => r.wo?.activity_name ?? ''))].filter(Boolean).sort(), [rows])

  const filtered = (rows ?? []).filter(
    (r) =>
      (!from || r.paid_on >= from) &&
      (!to || r.paid_on <= to) &&
      (!block || r.wo?.block_name === block) &&
      (!activity || r.wo?.activity_name === activity),
  )
  const total = filtered.reduce((t, r) => t + Number(r.amount), 0)

  function exportCsv() {
    const head = ['Date', 'Activity', 'Location', 'Paid up to %', 'This payment %', 'Amount RWF', 'Contract RWF', 'Notes']
    const lines = filtered.map((r) => [
      r.paid_on, r.wo?.activity_name ?? '', r.wo?.location ?? '', r.percent_to_date, r.percent_paid, r.amount, r.wo?.contract_amount ?? '', r.notes ?? '',
    ])
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `payments_${from || 'all'}_${to || 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageTitle
        title="Payments"
        subtitle="Every payment made. Amounts are calculated from the % paid, so nothing can be paid twice."
        action={<button className={btnGhost} onClick={exportCsv} disabled={!filtered.length}>Export CSV</button>}
      />
      <ErrorBox message={error} />
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Field label="From"><input className={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Block">
          <select className={input} value={block} onChange={(e) => setBlock(e.target.value)}>
            <option value="">All</option><option value="A">Block A</option><option value="B">Block B</option>
          </select>
        </Field>
        <Field label="Activity">
          <select className={input} value={activity} onChange={(e) => setActivity(e.target.value)}>
            <option value="">All</option>
            {activities.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
      </div>

      {!rows ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty>No payments found.</Empty>
      ) : (
        <>
          <Card className="mb-3 grid grid-cols-2 gap-4">
            <Stat label="Payments" value={filtered.length} />
            <Stat label="Total paid" value={money(total)} tone="good" />
          </Card>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Paid up to</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2">{date(r.paid_on)}</td>
                    <td className="px-3 py-2">
                      <Link className="text-teal-800 hover:underline" to={`/work-orders/${r.work_order_id}`}>{r.wo?.activity_name}</Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.wo?.location}</td>
                    <td className="px-3 py-2">{pct(r.percent_to_date)} <span className="text-xs text-slate-500">(+{pct(r.percent_paid)})</span></td>
                    <td className="px-3 py-2 text-right font-medium">{money(r.amount)}</td>
                    <td className="px-3 py-2 text-slate-600">{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
