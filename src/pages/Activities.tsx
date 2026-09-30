import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, friendlyError } from '../lib/supabase'
import type { Activity, Scope } from '../lib/types'
import { useAuth } from '../auth/AuthProvider'
import { btnPrimary, Card, Empty, ErrorBox, Field, input, Loading, PageTitle } from '../components/ui'

export default function Activities() {
  const { isAdmin } = useAuth()
  const [rows, setRows] = useState<(Activity & { count: number })[] | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [scope, setScope] = useState<Scope>('apartment')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const load = useCallback(async () => {
    const [a, w] = await Promise.all([
      supabase.from('activities').select('*').order('name'),
      supabase.from('work_orders').select('activity_id'),
    ])
    const err = a.error ?? w.error
    if (err) setError(friendlyError(err))
    const counts = new Map<number, number>()
    ;((w.data as { activity_id: number }[]) ?? []).forEach((x) => counts.set(x.activity_id, (counts.get(x.activity_id) ?? 0) + 1))
    setRows(((a.data as Activity[]) ?? []).map((x) => ({ ...x, count: counts.get(x.id) ?? 0 })))
  }, [])

  useEffect(() => { load() }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Type an activity name.')
    const { error } = await supabase.from('activities').insert({ name: name.trim(), scope })
    if (error) return setError(friendlyError(error))
    setName('')
    load()
  }

  async function rename(id: number) {
    const { error } = await supabase.from('activities').update({ name: editName.trim() }).eq('id', id)
    if (error) return setError(friendlyError(error))
    setEditId(null)
    load()
  }

  async function remove(a: Activity & { count: number }) {
    if (a.count > 0) return setError(`"${a.name}" is used by ${a.count} work order(s). Delete those first.`)
    if (!confirm(`Delete activity "${a.name}"?`)) return
    const { error } = await supabase.from('activities').delete().eq('id', a.id)
    if (error) return setError(friendlyError(error))
    load()
  }

  return (
    <div>
      <PageTitle title="Activities" subtitle="The list of contracted jobs. These appear as the dropdown when creating a work order." />
      {isAdmin && (
        <Card className="mb-4">
          <form onSubmit={add} className="grid items-end gap-3 sm:grid-cols-[1fr_220px_auto]">
            <Field label="Activity name">
              <input className={input} placeholder="e.g. Electrical wire pulling" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Contracted per">
              <select className={input} value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
                <option value="apartment">Apartment</option>
                <option value="floor">Floor</option>
              </select>
            </Field>
            <button className={btnPrimary}>Add activity</button>
          </form>
        </Card>
      )}
      <ErrorBox message={error} />
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>No activities yet.{isAdmin ? ' Add the first one above.' : ''}</Empty>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Activity</th>
                <th className="px-3 py-2">Per</th>
                <th className="px-3 py-2 text-right">Work orders</th>
                {isAdmin && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">
                    {editId === a.id ? (
                      <input className={input} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                    ) : (
                      a.name
                    )}
                  </td>
                  <td className="px-3 py-2">{a.scope === 'apartment' ? 'Apartment' : 'Floor'}</td>
                  <td className="px-3 py-2 text-right">{a.count} / {a.scope === 'apartment' ? 52 : 18}</td>
                  {isAdmin && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {editId === a.id ? (
                        <>
                          <button className="mr-3 text-teal-700 hover:underline" onClick={() => rename(a.id)}>Save</button>
                          <button className="text-slate-500 hover:underline" onClick={() => setEditId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="mr-3 text-teal-700 hover:underline" onClick={() => { setEditId(a.id); setEditName(a.name) }}>Rename</button>
                          <button className="text-red-700 hover:underline" onClick={() => remove(a)}>Delete</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
