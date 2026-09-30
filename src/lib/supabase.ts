import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-key',
)

/** Turn a Supabase/Postgres error into a sentence a site person understands. */
export function friendlyError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return ''
  const msg = err.message ?? 'Something went wrong.'
  if (err.code === '23505') {
    if (msg.includes('work_orders_unique_location'))
      return 'This activity is already contracted at this location. Open the existing work order instead.'
    if (msg.includes('activities_name_uq')) return 'An activity with this name already exists.'
    if (msg.includes('payments_work_order_id_percent_to_date')) return 'This percentage has already been paid for this work order.'
    return 'This record already exists.'
  }
  if (err.code === '23503') return 'This item is still used by other records, so it cannot be deleted.'
  if (err.code === '23514') {
    if (msg.includes('percent_to_date')) return 'Percentage must be above 0 and at most 100.'
    if (msg.includes('contract_amount')) return 'Contract amount must be greater than 0.'
  }
  if (err.code === '42501' || msg.includes('row-level security')) return 'Only admins can make changes.'
  return msg
}
