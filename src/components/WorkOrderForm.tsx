import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase, friendlyError } from '../lib/supabase'
import type { Activity, Apartment, Block, Floor } from '../lib/types'
import { aptSort } from '../lib/format'
import { btnGhost, btnPrimary, input, ErrorBox, Field } from './ui'

interface Props {
  /** Pre-select and lock a floor (used on the floor page). */
  fixedFloorId?: number
  onSaved: () => void
  onCancel: () => void
}

/** Create a work order: activity × location × contract amount. */
export default function WorkOrderForm({ fixedFloorId, onSaved, onCancel }: Props) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [floors, setFloors] = useState<Floor[]>([])
  const [apartments, setApartments] = useState<Apartment[]>([])

  const [activityId, setActivityId] = useState('')
  const [blockId, setBlockId] = useState('')
  const [floorId, setFloorId] = useState(fixedFloorId ? String(fixedFloorId) : '')
  const [apartmentId, setApartmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('activities').select('*').order('name'),
      supabase.from('blocks').select('*').order('name'),
      supabase.from('floors').select('*').order('number'),
      supabase.from('apartments').select('*').order('label'),
    ]).then(([a, b, f, ap]) => {
      setActivities((a.data as Activity[]) ?? [])
      setBlocks((b.data as Block[]) ?? [])
      setFloors((f.data as Floor[]) ?? [])
      setApartments((ap.data as Apartment[]) ?? [])
      if (fixedFloorId) {
        const fl = (f.data as Floor[] | null)?.find((x) => x.id === fixedFloorId)
        if (fl) setBlockId(String(fl.block_id))
      }
    })
  }, [fixedFloorId])

  const activity = activities.find((a) => String(a.id) === activityId)
  const floorOptions = useMemo(() => floors.filter((f) => String(f.block_id) === blockId), [floors, blockId])
  const aptOptions = useMemo(() => apartments.filter((a) => String(a.floor_id) === floorId).sort(aptSort), [apartments, floorId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!activity) return setError('Choose an activity.')
    if (!floorId) return setError('Choose a floor.')
    if (activity.scope === 'apartment' && !apartmentId) return setError('This activity is per apartment — choose an apartment.')
    const value = Number(amount)
    if (!(value > 0)) return setError('Enter a contract amount greater than 0.')

    setBusy(true)
    const { error } = await supabase.from('work_orders').insert({
      activity_id: activity.id,
      floor_id: Number(floorId),
      apartment_id: activity.scope === 'apartment' ? Number(apartmentId) : null,
      contract_amount: value,
      notes: notes.trim() || null,
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Activity" hint={activities.length === 0 ? 'No activities yet — add them on the Activities page.' : undefined}>
          <select className={input} value={activityId} onChange={(e) => { setActivityId(e.target.value); setApartmentId('') }}>
            <option value="">Choose…</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.scope === 'apartment' ? 'per apartment' : 'per floor'})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contract amount (RWF)">
          <input className={input} type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {!fixedFloorId && (
          <>
            <Field label="Block">
              <select className={input} value={blockId} onChange={(e) => { setBlockId(e.target.value); setFloorId(''); setApartmentId('') }}>
                <option value="">Choose…</option>
                {blocks.map((b) => <option key={b.id} value={b.id}>Block {b.name}</option>)}
              </select>
            </Field>
            <Field label="Floor">
              <select className={input} value={floorId} disabled={!blockId} onChange={(e) => { setFloorId(e.target.value); setApartmentId('') }}>
                <option value="">Choose…</option>
                {floorOptions.map((f) => <option key={f.id} value={f.id}>Floor {f.number}</option>)}
              </select>
            </Field>
          </>
        )}
        {activity?.scope === 'apartment' && (
          <Field label="Apartment">
            <select className={input} value={apartmentId} disabled={!floorId} onChange={(e) => setApartmentId(e.target.value)}>
              <option value="">Choose…</option>
              {aptOptions.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.unit_type}</option>)}
            </select>
          </Field>
        )}
        <Field label="Notes (optional)">
          <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <ErrorBox message={error} />
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Create work order'}</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
