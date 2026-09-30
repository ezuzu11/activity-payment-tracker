export type Role = 'admin' | 'viewer'
export type Scope = 'apartment' | 'floor'
export type Status = 'not_started' | 'in_progress' | 'completed'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: Role
}

export interface Block { id: number; name: string }
export interface Floor { id: number; block_id: number; number: number }
export interface Apartment { id: number; floor_id: number; label: string; unit_type: string }

export interface Activity {
  id: number
  name: string
  scope: Scope
  created_at: string
}

export interface WorkOrderView {
  id: number
  activity_id: number
  activity_name: string
  scope: Scope
  floor_id: number
  floor_number: number
  block_id: number
  block_name: string
  apartment_id: number | null
  apartment_label: string | null
  unit_type: string | null
  location: string
  contract_amount: number
  notes: string | null
  created_at: string
  paid_percent: number
  paid_amount: number
  balance: number
  payment_count: number
  last_paid_on: string | null
  status: Status
}

export interface PaymentView {
  id: number
  work_order_id: number
  paid_on: string
  percent_to_date: number
  notes: string | null
  created_at: string
  previous_percent: number
  percent_paid: number
  amount: number
}

export interface FloorProgress {
  floor_id: number
  block_id: number
  block_name: string
  floor_number: number
  total_work_orders: number
  completed: number
  remaining: number
  contract_total: number
  paid_total: number
  balance_total: number
  progress_percent: number
}
