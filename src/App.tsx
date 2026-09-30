import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import Login from './pages/Login'
import Building from './pages/Building'
import FloorPage from './pages/FloorPage'
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Payments from './pages/Payments'
import Activities from './pages/Activities'
import Users from './pages/Users'

function AppRoutes() {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Building />} />
        <Route path="floors/:id" element={<FloorPage />} />
        <Route path="work-orders" element={<WorkOrders />} />
        <Route path="work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="activities" element={<Activities />} />
        <Route path="users" element={isAdmin ? <Users /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
