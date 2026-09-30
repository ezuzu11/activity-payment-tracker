import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, friendlyError } from '../lib/supabase'
import type { FloorProgress } from '../lib/types'
import { money, pct } from '../lib/format'
import { Card, ErrorBox, Loading, PageTitle, ProgressBar, Stat } from '../components/ui'

export default function Building() {
  const [rows, setRows] = useState<FloorProgress[] | null>(null)
  const [error, setError] = useState('')
  const [block, setBlock] = useState<string>(() => localStorage.getItem('block') ?? 'A')

  useEffect(() => {
    supabase
      .from('v_floor_progress')
      .select('*')
      .order('block_name')
      .order('floor_number', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(friendlyError(error))
        setRows((data as FloorProgress[]) ?? [])
      })
  }, [])

  const blocks = useMemo(() => [...new Set((rows ?? []).map((r) => r.block_name))], [rows])
  const floors = (rows ?? []).filter((r) => r.block_name === block)

  const totals = floors.reduce(
    (t, f) => ({
      wo: t.wo + Number(f.total_work_orders),
      done: t.done + Number(f.completed),
      contract: t.contract + Number(f.contract_total),
      paid: t.paid + Number(f.paid_total),
    }),
    { wo: 0, done: 0, contract: 0, paid: 0 },
  )
  const blockPct = totals.contract ? (totals.paid / totals.contract) * 100 : 0

  function pick(b: string) {
    setBlock(b)
    localStorage.setItem('block', b)
  }

  return (
    <div>
      <PageTitle
        title="Progress by floor"
        subtitle="Progress is weighted by contract value and based on verified, paid percentages."
        action={
          <div className="flex rounded-lg border border-slate-300 bg-white p-1">
            {blocks.map((b) => (
              <button
                key={b}
                onClick={() => pick(b)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${block === b ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                Block {b}
              </button>
            ))}
          </div>
        }
      />
      <ErrorBox message={error} />
      {!rows ? (
        <Loading />
      ) : (
        <>
          <Card className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label={`Block ${block} progress`} value={pct(blockPct)} />
            <Stat label="Work orders done" value={`${totals.done} / ${totals.wo}`} />
            <Stat label="Paid to date" value={money(totals.paid)} tone="good" />
            <Stat label="Remaining to pay" value={money(totals.contract - totals.paid)} tone="warn" />
          </Card>

          <div className="space-y-2">
            {floors.map((f) => (
              <Link key={f.floor_id} to={`/floors/${f.floor_id}`} className="block">
                <Card className="transition hover:border-teal-500">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="w-24 font-semibold text-slate-900">Floor {f.floor_number}</div>
                    <div className="min-w-40 flex-1">
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>{pct(f.progress_percent)}</span>
                        <span>
                          {f.total_work_orders === 0
                            ? 'No work orders yet'
                            : `${f.completed} of ${f.total_work_orders} done · ${f.remaining} remaining`}
                        </span>
                      </div>
                      <ProgressBar value={f.progress_percent} />
                    </div>
                    <div className="ml-auto text-right text-sm">
                      <div className="text-emerald-700">{money(f.paid_total)}</div>
                      <div className="text-xs text-slate-500">of {money(f.contract_total)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
