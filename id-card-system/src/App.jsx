import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import AddMember from './pages/AddMember';
import EditMember from './pages/EditMember';
import MemberDetails from './pages/MemberDetails';
import Verify from './pages/Verify';
import Verification from './pages/Verification';
import Settings from './pages/Settings';
import SimplePage from './pages/SimplePage';
import CardPreview from './pages/CardPreview';
import './styles/global.css';
import './styles/dashboard.css';
import './styles/details.css';
import './styles/settings.css';
import './styles/simple.css';

/** Members reads ?status= for the sidebar status filters. */
function MembersRoute() {
  const [params] = useSearchParams();
  return <Members statusFilter={params.get('status') ?? 'all'} />;
}

/** Guarded admin area. ProtectedRoute fails closed if the session cannot be
 *  verified, so no admin view ever renders for an unauthenticated visitor. */
function AdminRoutes() {
  return (
    <ProtectedRoute>
      <AdminLayout />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ---------- public ---------- */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify/:memberId" element={<Verify />} />
          <Route path="/dev/card" element={<CardPreview />} />

          {/* ---------- simple card generator (default) ---------- */}
          <Route path="/" element={<SimplePage />} />

          {/* ---------- admin (protected) ---------- */}
            <Route element={<AdminRoutes />}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/members" element={<MembersRoute />} />
              <Route path="/admin/members/new" element={<AddMember />} />
              {/* /members/new must precede the :memberId route so "new" is not
                  read as an ID number. */}
              <Route path="/admin/members/:memberId/edit" element={<EditMember />} />
              <Route path="/admin/members/:memberId" element={<MemberDetails />} />
              <Route path="/admin/verification" element={<Verification />} />
              <Route path="/admin/settings" element={<Settings />} />
            </Route>

          <Route path="/members" element={<Navigate to="/admin/members" replace />} />
          <Route path="/members/new" element={<Navigate to="/admin/members/new" replace />} />
          <Route path="/members/:memberId" element={<Navigate to="/admin/members" replace />} />
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/verification" element={<Navigate to="/admin/verification" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}