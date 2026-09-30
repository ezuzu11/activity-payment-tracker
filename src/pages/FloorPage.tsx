import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import type { Apartment, FloorProgress, WorkOrderView } from '../lib/types'
import { aptSort, money, pct } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import WorkOrderForm from '../components/WorkOrderForm'
import WorkOrderTable from '../components/WorkOrderTable'
import { btnPrimary, Card, Empty, ErrorBox, Loading, PageTitle, ProgressBar, Stat } from '../components/ui'

export default function FloorPage() {
  const { id } = useParams()
  const floorId = Number(id)
  const { isAdmin } = useAuth()
  const [floor, setFloor] = useState<FloorProgress | null>(null)
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [orders, setOrders] = useState<WorkOrderView[] | null>(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const [f, ap, wo] = await Promise.all([
      supabase.from('v_floor_progress').select('*').eq('floor_id', floorId).maybeSingle(),
      supabase.from('apartments').select('*').eq('floor_id', floorId).order('label'),
      supabase.from('v_work_orders').select('*').eq('floor_id', floorId).order('activity_name'),
    ])
    const err = f.error ?? ap.error ?? wo.error
    if (err) setError(friendlyError(err))
    setFloor(f.data as FloorProgress | null)
    setApartments(((ap.data as Apartment[]) ?? []).sort(aptSort))
    setOrders((wo.data as WorkOrderView[]) ?? [])
  }, [floorId])

  useEffect(() => { load() }, [load])

  if (!orders) return <Loading />
  if (!floor) return <ErrorBox message={error || 'Floor not found.'} />

  const floorWide = orders.filter((o) => o.apartment_id === null)
  const remaining = orders.filter((o) => o.status !== 'completed')

  return (
    <div>
      <Link to="/" className="text-sm text-teal-700 hover:underline">← All floors</Link>
      <PageTitle
        title={`Block ${floor.block_name} · Floor ${floor.floor_number}`}
        subtitle={`${apartments.map((a) => `${a.label} (${a.unit_type})`).join(' · ')}`}
        action={isAdmin && !adding && <button className={btnPrimary} onClick={() => setAdding(true)}>+ Add work order</button>}
      />
      <ErrorBox message={error} />

      {adding && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">New work order on this floor</h2>
          <WorkOrderForm fixedFloorId={floorId} onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Progress" value={pct(floor.progress_percent)} />
          <Stat label="Work orders done" value={`${floor.completed} / ${floor.total_work_orders}`} />
          <Stat label="Paid to date" value={money(floor.paid_total)} tone="good" />
          <Stat label="Remaining to pay" value={money(floor.balance_total)} tone="warn" />
        </div>
        <div className="mt-3"><ProgressBar value={floor.progress_percent} /></div>
      </Card>

      {orders.length === 0 ? (
        <Empty>No work orders on this floor yet.</Empty>
      ) : (
        <div className="space-y-6">
          {remaining.length > 0 && (
            <section>
              <h2 className="mb-2 font-medium text-slate-900">Remaining on this floor ({remaining.length})</h2>
              <WorkOrderTable rows={remaining} />
            </section>
          )}
          <section>
            <h2 className="mb-2 font-medium text-slate-900">Floor-wide activities</h2>
            {floorWide.length ? <WorkOrderTable rows={floorWide} showLocation={false} /> : <Empty>None yet.</Empty>}
          </section>
          {apartments.map((ap) => {
            const rows = orders.filter((o) => o.apartment_id === ap.id)
            return (
              <section key={ap.id}>
                <h2 className="mb-2 font-medium text-slate-900">
                  Apartment {ap.label} <span className="text-sm font-normal text-slate-500">· {ap.unit_type}</span>
                </h2>
                {rows.length ? <WorkOrderTable rows={rows} showLocation={false} /> : <Empty>None yet.</Empty>}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
