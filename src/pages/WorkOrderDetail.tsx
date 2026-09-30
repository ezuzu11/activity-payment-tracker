import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import type { PaymentView, WorkOrderView } from '../lib/types'
import { date, money, pct, today } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'
import {
  btnDanger, btnGhost, btnPrimary, Card, Empty, ErrorBox, Field, input, Loading, PageTitle, ProgressBar, Stat, StatusBadge,
} from '../components/ui'

export default function WorkOrderDetail() {
  const { id } = useParams()
  const woId = Number(id)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [wo, setWo] = useState<WorkOrderView | null>(null)
  const [payments, setPayments] = useState<PaymentView[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    const [w, p] = await Promise.all([
      supabase.from('v_work_orders').select('*').eq('id', woId).maybeSingle(),
      supabase.from('v_payments').select('*').eq('work_order_id', woId).order('percent_to_date'),
    ])
    const err = w.error ?? p.error
    if (err) setError(friendlyError(err))
    setWo(w.data as WorkOrderView | null)
    setPayments((p.data as PaymentView[]) ?? [])
    setLoaded(true)
  }, [woId])

  useEffect(() => { load() }, [load])

  async function deleteWorkOrder() {
    if (!wo) return
    const msg = payments.length
      ? `Delete this work order AND its ${payments.length} payment record(s)? This cannot be undone.`
      : 'Delete this work order?'
    if (!confirm(msg)) return
    const { error } = await supabase.from('work_orders').delete().eq('id', wo.id)
    if (error) return setError(friendlyError(error))
    navigate(`/floors/${wo.floor_id}`)
  }

  async function deletePayment(p: PaymentView) {
    if (!confirm(`Delete the payment "up to ${pct(p.percent_to_date)}" (${money(p.amount)})?`)) return
    const { error } = await supabase.from('payments').delete().eq('id', p.id)
    if (error) return setError(friendlyError(error))
    load()
  }

  if (!loaded) return <Loading />
  if (!wo) return <ErrorBox message={error || 'Work order not found.'} />

  return (
    <div>
      <Link to={`/floors/${wo.floor_id}`} className="text-sm text-teal-700 hover:underline">
        ← Block {wo.block_name} · Floor {wo.floor_number}
      </Link>
      <PageTitle
        title={wo.activity_name}
        subtitle={
          <span>
            <span className="font-mono">{wo.location}</span>
            {wo.unit_type && ` · ${wo.unit_type}`} · {wo.scope === 'apartment' ? 'per apartment' : 'per floor'} · WO-{wo.id}
          </span>
        }
        action={
          isAdmin && (
            <div className="flex gap-2">
              <button className={btnGhost} onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</button>
              <button className={btnDanger} onClick={deleteWorkOrder}>Delete</button>
            </div>
          )
        }
      />
      <ErrorBox message={error} />

      {editing && <EditWorkOrder wo={wo} hasPayments={payments.length > 0} onSaved={() => { setEditing(false); load() }} />}

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Contract" value={money(wo.contract_amount)} />
          <Stat label="Paid" value={`${money(wo.paid_amount)} (${pct(wo.paid_percent)})`} tone="good" />
          <Stat label="Balance" value={money(wo.balance)} tone="warn" />
          <div>
            <div className="text-xs text-slate-500">Status</div>
            <div className="mt-1"><StatusBadge status={wo.status} /></div>
          </div>
        </div>
        <div className="mt-3"><ProgressBar value={wo.paid_percent} /></div>
        {wo.notes && <p className="mt-3 text-sm text-slate-600">Note: {wo.notes}</p>}
      </Card>

      {isAdmin && wo.paid_percent < 100 && <RecordPayment wo={wo} onSaved={load} />}

      <h2 className="mb-2 mt-6 font-medium text-slate-900">Payment history</h2>
      {payments.length === 0 ? (
        <Empty>No payments yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Paid up to</th>
                <th className="px-3 py-2">This payment</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Notes</th>
                {isAdmin && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <PaymentRow key={p.id} p={p} isAdmin={isAdmin} onChanged={load} onDelete={() => deletePayment(p)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecordPayment({ wo, onSaved }: { wo: WorkOrderView; onSaved: () => void }) {
  const [percent, setPercent] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const p = Number(percent)
  const valid = p > Number(wo.paid_percent) && p <= 100
  const preview = valid ? (Number(wo.contract_amount) * (p - Number(wo.paid_percent))) / 100 : 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!valid) return setError(`Enter a percentage above ${pct(wo.paid_percent)} and at most 100%.`)
    setBusy(true)
    const { error } = await supabase.from('payments').insert({
      work_order_id: wo.id,
      percent_to_date: p,
      paid_on: paidOn,
      notes: notes.trim() || null,
    })
    setBusy(false)
    if (error) return setError(friendlyError(error))
    setPercent('')
    setNotes('')
    onSaved()
  }

  return (
    <Card>
      <h2 className="mb-1 font-medium">Record a payment</h2>
      <p className="mb-3 text-sm text-slate-500">
        Enter the TOTAL % of the job verified as done so far (already paid up to {pct(wo.paid_percent)}).
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Work done to date (%)">
            <input className={input} type="number" min="0.01" max="100" step="0.01" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </Field>
          <Field label="Payment date">
            <input className={input} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </Field>
          <Field label="Notes (optional)">
            <input className={input} placeholder="e.g. stopped – no wire in stock" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        {valid && (
          <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
            Pay now: <strong>{money(preview)}</strong> ({pct(p - Number(wo.paid_percent))} of {money(wo.contract_amount)})
          </div>
        )}
        <ErrorBox message={error} />
        <button className={btnPrimary} disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button>
      </form>
    </Card>
  )
}

function PaymentRow({ p, isAdmin, onChanged, onDelete }: { p: PaymentView; isAdmin: boolean; onChanged: () => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false)
  const [percent, setPercent] = useState(String(p.percent_to_date))
  const [paidOn, setPaidOn] = useState(p.paid_on)
  const [notes, setNotes] = useState(p.notes ?? '')
  const [error, setError] = useState('')

  async function save() {
    setError('')
    const { error } = await supabase
      .from('payments')
      .update({ percent_to_date: Number(percent), paid_on: paidOn, notes: notes.trim() || null })
      .eq('id', p.id)
    if (error) return setError(friendlyError(error))
    setEdit(false)
    onChanged()
  }

  if (edit)
    return (
      <tr className="bg-amber-50/50">
        <td className="px-3 py-2"><input className={input} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></td>
        <td className="px-3 py-2"><input className={input} type="number" min="0.01" max="100" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} /></td>
        <td className="px-3 py-2 text-xs text-slate-500" colSpan={2}>Amounts recalculate after saving.{error && <div className="mt-1 text-red-700">{error}</div>}</td>
        <td className="px-3 py-2"><input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} /></td>
        <td className="whitespace-nowrap px-3 py-2">
          <button className="mr-2 text-teal-700 hover:underline" onClick={save}>Save</button>
          <button className="text-slate-500 hover:underline" onClick={() => setEdit(false)}>Cancel</button>
        </td>
      </tr>
    )

  return (
    <tr>
      <td className="px-3 py-2">{date(p.paid_on)}</td>
      <td className="px-3 py-2">{pct(p.percent_to_date)}</td>
      <td className="px-3 py-2 text-slate-500">+{pct(p.percent_paid)}</td>
      <td className="px-3 py-2 text-right font-medium">{money(p.amount)}</td>
      <td className="px-3 py-2 text-slate-600">{p.notes}</td>
      {isAdmin && (
        <td className="whitespace-nowrap px-3 py-2 text-right">
          <button className="mr-3 text-teal-700 hover:underline" onClick={() => setEdit(true)}>Edit</button>
          <button className="text-red-700 hover:underline" onClick={onDelete}>Delete</button>
        </td>
      )}
    </tr>
  )
}

function EditWorkOrder({ wo, hasPayments, onSaved }: { wo: WorkOrderView; hasPayments: boolean; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(wo.contract_amount))
  const [notes, setNotes] = useState(wo.notes ?? '')
  const [error, setError] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!(value > 0)) return setError('Contract amount must be greater than 0.')
    if (hasPayments && value !== Number(wo.contract_amount) &&
        !confirm('This work order already has payments. Changing the contract amount will recalculate all payment amounts. Continue?')) return
    const { error } = await supabase.from('work_orders').update({ contract_amount: value, notes: notes.trim() || null }).eq('id', wo.id)
    if (error) return setError(friendlyError(error))
    onSaved()
  }

  return (
    <Card className="mb-4">
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contract amount (RWF)">
            <input className={input} type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Notes">
            <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">To change the activity or location, delete this work order and create a new one.</p>
        <ErrorBox message={error} />
        <button className={btnPrimary}>Save changes</button>
      </form>
    </Card>
  )
}
