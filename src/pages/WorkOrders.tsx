import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, friendlyError } from '../lib/supabase'
import type { WorkOrderView } from '../lib/types'
import { money } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import WorkOrderForm from '../components/WorkOrderForm'
import WorkOrderTable from '../components/WorkOrderTable'
import { btnPrimary, Card, Empty, ErrorBox, input, Loading, PageTitle } from '../components/ui'

export default function WorkOrders() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState<WorkOrderView[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [block, setBlock] = useState('')
  const [activity, setActivity] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('v_work_orders')
      .select('*')
      .order('block_name')
      .order('floor_number')
      .order('apartment_label', { nullsFirst: true })
    if (error) setError(friendlyError(error))
    setRows((data as WorkOrderView[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const activities = useMemo(() => [...new Set((rows ?? []).map((r) => r.activity_name))].sort(), [rows])
  const blocks = useMemo(() => [...new Set((rows ?? []).map((r) => r.block_name))].sort(), [rows])

  const filtered = (rows ?? []).filter(
    (r) =>
      (!block || r.block_name === block) &&
      (!activity || r.activity_name === activity) &&
      (!status || r.status === status) &&
      (!q || `${r.activity_name} ${r.location} ${r.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )
  const total = filtered.reduce((t, r) => ({ c: t.c + Number(r.contract_amount), p: t.p + Number(r.paid_amount) }), { c: 0, p: 0 })

  return (
    <div>
      <PageTitle
        title="Work orders"
        subtitle="One row per activity at one location."
        action={isAdmin && !adding && <button className={btnPrimary} onClick={() => setAdding(true)}>+ Add work order</button>}
      />
      {adding && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">New work order</h2>
          <WorkOrderForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
        </Card>
      )}
      <ErrorBox message={error} />

      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <input className={input} placeholder="Search activity, location, note…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={block} onChange={(e) => setBlock(e.target.value)}>
          <option value="">All blocks</option>
          {blocks.map((b) => <option key={b} value={b}>Block {b}</option>)}
        </select>
        <select className={input} value={activity} onChange={(e) => setActivity(e.target.value)}>
          <option value="">All activities</option>
          {activities.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {!rows ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty>No work orders match.</Empty>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">
            {filtered.length} work orders · contract {money(total.c)} · paid {money(total.p)} · balance {money(total.c - total.p)}
          </p>
          <WorkOrderTable rows={filtered} />
        </>
      )}
    </div>
  )
}
