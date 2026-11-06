import {
  BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useParams,
} from 'react-router-dom';
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
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Home from './pages/Home';
import SimplePage from './pages/SimplePage';
import CardPreview from './pages/CardPreview';
// Self-hosted Devanagari face. Loaded before global.css so the token stack
// resolves to it, and same-origin so html-to-image can embed it when exporting.
import './styles/fonts.css';
import './styles/global.css';
import './styles/dashboard.css';
import './styles/details.css';
import './styles/settings.css';
import './styles/simple.css';
import './styles/responsive.css';

/**
 * Back-compat for the pre-/admin paths.
 *
 * Preserves the query string, which a plain <Navigate to="/admin/members"> does
 * not: the sidebar's "Active IDs" link is /members?status=active, and dropping
 * the filter on the way through would land the operator on an unfiltered list.
 */
function LegacyRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
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

/**
 * The gate for every signed-in page that is NOT part of the admin shell chrome
 * (the landing page and the card generator render standalone, without the
 * sidebar).
 *
 * The application is administrator-only: the register holds identity documents,
 * so the landing page, the generator and the card preview all sit behind the
 * same check as the admin area. The only public routes are sign-in, the
 * password notice and QR verification - a person scanning a card has no
 * account, and a verification page that demanded one would be useless.
 */
function SignedIn() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}

function MemberRoute({ edit = false }) {
  const { memberId } = useParams();
  return edit ? <EditMember key={memberId} /> : <MemberDetails key={memberId} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ---------- public: sign-in, password notice, QR verification ---------- */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify/:memberId" element={<Verify />} />
          {import.meta.env.DEV && <Route path="/dev/card" element={<CardPreview />} />}

          {/* ---------- signed-in, standalone (no admin chrome) ---------- */}
          <Route element={<SignedIn />}>
            <Route path="/" element={<Home />} />
            <Route path="/generate" element={<SimplePage />} />
          </Route>

          {/* ---------- signed-in: admin shell ---------- */}
          <Route element={<AdminRoutes />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/members" element={<Members />} />
            <Route path="/admin/members/new" element={<AddMember />} />
            {/* /admin/members/new must precede the :memberId route so "new"
                is not read as an ID number. */}
            <Route path="/admin/members/:memberId/edit" element={<MemberRoute edit />} />
            <Route path="/admin/members/:memberId" element={<MemberRoute />} />
            <Route path="/admin/verification" element={<Verification />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/settings" element={<Settings />} />
          </Route>

          {/* Pre-/admin paths kept alive for old bookmarks and links. */}
          <Route path="/card" element={<Navigate to="/generate" replace />} />
          <Route path="/create" element={<Navigate to="/generate" replace />} />
          <Route path="/members" element={<LegacyRedirect to="/admin/members" />} />
          <Route path="/members/new" element={<LegacyRedirect to="/admin/members/new" />} />
          <Route path="/members/:memberId" element={<LegacyRedirect to="/admin/members" />} />
          <Route path="/settings" element={<LegacyRedirect to="/admin/settings" />} />
          <Route path="/verification" element={<LegacyRedirect to="/admin/verification" />} />

          {/* Anything unknown lands on the gate, which sends an anonymous
              visitor to sign-in rather than showing a public 404. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
