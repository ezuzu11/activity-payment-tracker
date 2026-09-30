import { useState, type FormEvent } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { btnPrimary, input, ErrorBox, Field } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Activity Payment Tracker</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        {!isConfigured && (
          <ErrorBox message="Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README)." />
        )}
        <Field label="Email">
          <input className={input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <ErrorBox message={error} />
        <button className={`${btnPrimary} w-full`} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-xs text-slate-500">No account? Ask an admin to invite you.</p>
      </form>
    </div>
  )
}
