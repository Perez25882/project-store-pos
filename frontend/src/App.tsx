import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Products from '@/pages/Products';
import Inventory from '@/pages/Inventory';
import Sales from '@/pages/Sales';
import Suppliers from '@/pages/Suppliers';
import Procurement from '@/pages/Procurement';
import Accounting from '@/pages/Accounting';
import Reports from '@/pages/Reports';
import Customers from '@/pages/Customers';
import Staff from '@/pages/Staff';
import Settings from '@/pages/Settings';
import Layout from '@/components/Layout';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
      </Route>
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Products />} />
      </Route>
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Inventory />} />
      </Route>
      <Route
        path="/sales"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Sales />} />
      </Route>
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Suppliers />} />
      </Route>
      <Route
        path="/procurement"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Procurement />} />
      </Route>
      <Route
        path="/accounting"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Accounting />} />
      </Route>
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Reports />} />
      </Route>
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Customers />} />
      </Route>
      <Route
        path="/staff"
        element={
          <ProtectedRoute adminOnly>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Staff />} />
      </Route>
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Settings />} />
      </Route>
      <Route path="/:storeId/*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
