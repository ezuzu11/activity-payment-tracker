import { Link } from 'react-router-dom'
import type { WorkOrderView } from '../lib/types'
import { money, pct } from '../lib/format'
import { ProgressBar, StatusBadge } from './ui'

export default function WorkOrderTable({ rows, showLocation = true }: { rows: WorkOrderView[]; showLocation?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Activity</th>
            {showLocation && <th className="px-3 py-2">Location</th>}
            <th className="px-3 py-2 text-right">Contract</th>
            <th className="px-3 py-2 w-40">Paid</th>
            <th className="px-3 py-2 text-right">Balance</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((w) => (
            <tr key={w.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <Link to={`/work-orders/${w.id}`} className="font-medium text-teal-800 hover:underline">
                  {w.activity_name}
                </Link>
              </td>
              {showLocation && <td className="px-3 py-2 font-mono text-xs">{w.location}</td>}
              <td className="px-3 py-2 text-right">{money(w.contract_amount)}</td>
              <td className="px-3 py-2">
                <div className="mb-1 flex justify-between text-xs">
                  <span>{pct(w.paid_percent)}</span>
                  <span className="text-slate-500">{money(w.paid_amount)}</span>
                </div>
                <ProgressBar value={w.paid_percent} />
              </td>
              <td className="px-3 py-2 text-right">{money(w.balance)}</td>
              <td className="px-3 py-2"><StatusBadge status={w.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
