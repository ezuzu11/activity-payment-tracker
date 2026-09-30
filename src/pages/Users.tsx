import { useCallback, useEffect, useState } from 'react'
import { supabase, friendlyError } from '../lib/supabase'
import type { Profile, Role } from '../lib/types'
import { useAuth } from '../auth/AuthProvider'
import { Card, ErrorBox, Loading, PageTitle } from '../components/ui'

export default function Users() {
  const { profile: me } = useAuth()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('id, email, full_name, role').order('email')
    if (error) setError(friendlyError(error))
    setRows((data as Profile[]) ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  async function setRole(p: Profile, role: Role) {
    if (p.id === me?.id && role !== 'admin' && !confirm('Remove your own admin access? You will become view-only.')) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
    if (error) return setError(friendlyError(error))
    load()
  }

  return (
    <div>
      <PageTitle title="Users" subtitle="Admins can add, edit and delete. Viewers can only look." />
      <Card className="mb-4 text-sm text-slate-600">
        To add someone: Supabase dashboard → Authentication → Users → <strong>Invite user</strong>. They appear here as
        a viewer after accepting; promote them to admin if needed.
      </Card>
      <ErrorBox message={error} />
      {!rows ? (
        <Loading />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">{p.email}{p.id === me?.id && <span className="ml-2 text-xs text-slate-500">(you)</span>}</td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1"
                      value={p.role}
                      onChange={(e) => setRole(p, e.target.value as Role)}
                    >
                      <option value="viewer">Viewer (read-only)</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
