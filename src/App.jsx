import { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import { Loading, EmptyState, ErrorState } from './components/ui.jsx';

import { Login, Register, ForgotPassword, VerifyOtp, ResetPassword } from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { LeadList, LeadDetail } from './pages/Leads.jsx';
import Pipeline from './pages/Pipeline.jsx';
import { CustomerList, CustomerDetail, CompanyList, CompanyDetail, ContactList, ContactDetail } from './pages/Accounts.jsx';
import { Calendar, Activities, Tasks } from './pages/Work.jsx';
import { Products, QuotationList, QuotationDetail, SalesOrders, InvoiceList, InvoiceDetail, Payments } from './pages/Sales.jsx';
import { Campaigns, EmailModule } from './pages/Marketing.jsx';
import { TicketList, TicketDetail } from './pages/Support.jsx';
import Reports from './pages/Reports.jsx';
import Tracking from './pages/Tracking.jsx';
import Settings, { Profile, ChangePassword } from './pages/Settings.jsx';

/**
 * Wraps a route with authentication + optional permission check.
 *
 *   <RequireAuth perm="leads.view">…</RequireAuth>
 *
 * `perm` is the dot-notation permission string from the Role matrix
 * (e.g. "leads.view"). When omitted only authentication is required.
 * Portal customers (role === 'Customer') are allowed through when no perm is given.
 */
function RequireAuth({ children, perm }) {
  const { isAuthenticated, loading, hasPerm } = useAuth();
  const location = useLocation();

  if (loading) return <div className="grid min-h-screen place-items-center"><Loading label="Checking your session…" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (perm && !hasPerm(perm)) {
    return (
      <div className="p-8">
        <EmptyState title="You don't have access to this area" hint="Ask an administrator if you need it." />
      </div>
    );
  }
  return children;
}

/**
 * Catches a render error in a screen so the rest of the app survives.
 *
 * Without this a single bad field reference blanked the entire page with no
 * message — the user's only clue was that a menu appeared to do nothing.
 * Keyed on the route, so navigating away clears the error.
 */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[render] screen failed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-8">
        <ErrorState
          message={`This screen could not be displayed: ${this.state.error.message}`}
          onRetry={() => this.setState({ error: null })}
        />
      </div>
    );
  }
}

function Screen({ children }) {
  const location = useLocation();
  return <RouteErrorBoundary key={location.pathname}>{children}</RouteErrorBoundary>;
}

function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center"><Loading /></div>;
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

/**
 * Landing page. The dashboard is staff-only on the server, so sending a portal
 * customer there greeted them with three 403s the moment they signed in —
 * their home is the support desk.
 */
function Home() {
  const { user } = useAuth();
  return user?.role === 'Customer' ? <Navigate to="/support" replace /> : <Dashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
          <Route path="/verify-otp" element={<PublicOnly><VerifyOtp /></PublicOnly>} />
          <Route path="/reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />

          {/* Authenticated app shell — any logged-in user enters the layout */}
          <Route element={<RequireAuth><Screen><Layout /></Screen></RequireAuth>}>
            {/* Dashboard for staff; portal customers go to their tickets */}
            <Route index element={<Home />} />

            {/* Sales */}
            <Route path="leads" element={<RequireAuth perm="leads.view"><LeadList /></RequireAuth>} />
            <Route path="leads/:id" element={<RequireAuth perm="leads.view"><LeadDetail /></RequireAuth>} />

            <Route path="customers" element={<RequireAuth perm="customers.view"><CustomerList /></RequireAuth>} />
            <Route path="customers/:id" element={<RequireAuth perm="customers.view"><CustomerDetail /></RequireAuth>} />
            <Route path="companies" element={<RequireAuth perm="companies.view"><CompanyList /></RequireAuth>} />
            <Route path="companies/:id" element={<RequireAuth perm="companies.view"><CompanyDetail /></RequireAuth>} />
            <Route path="contacts" element={<RequireAuth perm="contacts.view"><ContactList /></RequireAuth>} />
            <Route path="contacts/:id" element={<RequireAuth perm="contacts.view"><ContactDetail /></RequireAuth>} />

            <Route path="pipeline" element={<RequireAuth perm="opportunities.view"><Pipeline /></RequireAuth>} />

            {/* Work */}
            <Route path="calendar" element={<RequireAuth perm="activities.view"><Calendar /></RequireAuth>} />
            <Route path="activities" element={<RequireAuth perm="activities.view"><Activities /></RequireAuth>} />
            <Route path="tasks" element={<RequireAuth perm="tasks.view"><Tasks /></RequireAuth>} />

            {/* Revenue */}
            <Route path="products" element={<RequireAuth perm="products.view"><Products /></RequireAuth>} />
            <Route path="quotations" element={<RequireAuth perm="quotations.view"><QuotationList /></RequireAuth>} />
            <Route path="quotations/:id" element={<RequireAuth perm="quotations.view"><QuotationDetail /></RequireAuth>} />
            <Route path="orders" element={<RequireAuth perm="orders.view"><SalesOrders /></RequireAuth>} />
            <Route path="invoices" element={<RequireAuth perm="invoices.view"><InvoiceList /></RequireAuth>} />
            <Route path="invoices/:id" element={<RequireAuth perm="invoices.view"><InvoiceDetail /></RequireAuth>} />
            <Route path="payments" element={<RequireAuth perm="payments.view"><Payments /></RequireAuth>} />

            {/* Engage */}
            <Route path="campaigns" element={<RequireAuth perm="campaigns.view"><Campaigns /></RequireAuth>} />
            <Route path="emails" element={<RequireAuth perm="campaigns.view"><EmailModule /></RequireAuth>} />

            {/* Support — portal customers (Customer role) can access their own tickets */}
            <Route path="support" element={<TicketList />} />
            <Route path="support/:id" element={<TicketDetail />} />

            {/* Insights */}
            <Route path="reports" element={<RequireAuth perm="reports.view"><Reports /></RequireAuth>} />
            <Route path="tracking" element={<RequireAuth perm="leads.view"><Tracking /></RequireAuth>} />
            <Route path="settings" element={<RequireAuth perm="settings.view"><Settings /></RequireAuth>} />

            {/* Profile is accessible to every authenticated user */}
            <Route path="profile" element={<Profile />} />
            <Route path="change-password" element={<ChangePassword />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
