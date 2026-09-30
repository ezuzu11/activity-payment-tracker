import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto font-semibold text-slate-900 sm:mr-2">Activity Payment Tracker</div>
          <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            <NavLink to="/" end className={linkClass}>Progress</NavLink>
            <NavLink to="/work-orders" className={linkClass}>Work orders</NavLink>
            <NavLink to="/payments" className={linkClass}>Payments</NavLink>
            <NavLink to="/activities" className={linkClass}>Activities</NavLink>
            {isAdmin && <NavLink to="/users" className={linkClass}>Users</NavLink>}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">{profile?.email}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isAdmin ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>
              {isAdmin ? 'Admin' : 'View only'}
            </span>
            <button onClick={signOut} className="rounded-lg px-2 py-1 text-slate-600 hover:bg-slate-100">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
