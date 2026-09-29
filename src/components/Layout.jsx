import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, ROLE_LABEL } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { Avatar } from './ui.jsx';
import { fromNow } from '../lib/format.js';
import { APP_NAME } from '../lib/config.js';

const icon = (d) => (
  <svg className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const I = {
  dashboard: 'M4 5h6v6H4V5zm0 8h6v6H4v-6zm10-8h6v10h-6V5zm0 12h6v2h-6v-2z',
  leads: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5',
  customers: 'M17 20h5v-2a3 3 0 00-5.4-1.8M17 20H7m10 0v-2c0-.7-.1-1.3-.4-1.8M7 20H2v-2a3 3 0 015.4-1.8M7 20v-2c0-.7.1-1.3.4-1.8m0 0a5 5 0 019.2 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  companies: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h2m-2 4h2m4-4h2m-2 4h2M9 21v-4h6v4',
  contacts: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4z',
  pipeline: 'M4 6h16M6 12h12M9 18h6',
  calendar: 'M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  activities: 'M13 10V3L4 14h7v7l9-11h-7z',
  tasks: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  products: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4',
  quotations: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6L19 9.4V19a2 2 0 01-2 2z',
  orders: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  invoices: 'M9 14h6m-6-4h6m4 11l-2-2-2 2-2-2-2 2-2-2-2 2V5a2 2 0 012-2h10a2 2 0 012 2v16z',
  payments: 'M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  campaigns: 'M11 5.9L6 9H2v6h4l5 3.1V5.9zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13',
  email: 'M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  support: 'M18.4 18.4A9 9 0 105.6 5.6a9 9 0 0012.8 12.8zM15 9l-6 6m0-6l6 6',
  reports: 'M9 17V9m4 8V5m4 12v-6M4 21h16a1 1 0 001-1V4a1 1 0 00-1-1H4a1 1 0 00-1 1v16a1 1 0 001 1z',
  tracking: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  settings: 'M10.3 4.3a1 1 0 011.4 0l1 1a1 1 0 001 .3l1.4-.3a1 1 0 011.2.7l.4 1.4a1 1 0 00.7.7l1.4.4a1 1 0 01.7 1.2l-.3 1.4a1 1 0 00.3 1l1 1a1 1 0 010 1.4l-1 1a1 1 0 00-.3 1l.3 1.4a1 1 0 01-.7 1.2l-1.4.4a1 1 0 00-.7.7l-.4 1.4a1 1 0 01-1.2.7l-1.4-.3a1 1 0 00-1 .3l-1 1a1 1 0 01-1.4 0l-1-1a1 1 0 00-1-.3l-1.4.3a1 1 0 01-1.2-.7l-.4-1.4a1 1 0 00-.7-.7l-1.4-.4a1 1 0 01-.7-1.2l.3-1.4a1 1 0 00-.3-1l-1-1a1 1 0 010-1.4l1-1a1 1 0 00.3-1l-.3-1.4a1 1 0 01.7-1.2l1.4-.4a1 1 0 00.7-.7l.4-1.4a1 1 0 011.2-.7l1.4.3a1 1 0 001-.3l1-1zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

/**
 * Sidebar definition.
 * Each item may declare `perm` (a dot-notation permission string from the Role
 * matrix, e.g. "leads.view"). Items without `perm` are always shown to any
 * authenticated user — this is intentional for Dashboard and Support.
 */
export const NAV = [
  { section: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: I.dashboard, end: true },
  ] },
  { section: 'Sales', items: [
    { to: '/leads', label: 'Leads', icon: I.leads, perm: 'leads.view' },
    { to: '/customers', label: 'Customers', icon: I.customers, perm: 'customers.view' },
    { to: '/companies', label: 'Companies', icon: I.companies, perm: 'companies.view' },
    { to: '/contacts', label: 'Contacts', icon: I.contacts, perm: 'contacts.view' },
    { to: '/pipeline', label: 'Pipeline', icon: I.pipeline, perm: 'opportunities.view' },
  ] },
  { section: 'Work', items: [
    { to: '/calendar', label: 'Calendar', icon: I.calendar, perm: 'activities.view' },
    { to: '/activities', label: 'Activities', icon: I.activities, perm: 'activities.view' },
    { to: '/tasks', label: 'Tasks', icon: I.tasks, perm: 'tasks.view' },
  ] },
  { section: 'Revenue', items: [
    { to: '/products', label: 'Products', icon: I.products, perm: 'products.view' },
    { to: '/quotations', label: 'Quotations', icon: I.quotations, perm: 'quotations.view' },
    { to: '/orders', label: 'Sales Orders', icon: I.orders, perm: 'orders.view' },
    { to: '/invoices', label: 'Invoices', icon: I.invoices, perm: 'invoices.view' },
    { to: '/payments', label: 'Payments', icon: I.payments, perm: 'payments.view' },
  ] },
  { section: 'Engage', items: [
    { to: '/campaigns', label: 'Campaigns', icon: I.campaigns, perm: 'campaigns.view' },
    { to: '/emails', label: 'Email', icon: I.email, perm: 'campaigns.view' },
    { to: '/support', label: 'Support', icon: I.support },   // open to portal customers too
  ] },
  { section: 'Insights', items: [
    { to: '/reports', label: 'Reports', icon: I.reports, perm: 'reports.view' },
    { to: '/tracking', label: 'Tracking', icon: I.tracking, perm: 'leads.view' },
    { to: '/settings', label: 'Settings', icon: I.settings, perm: 'settings.view' },
  ] },
];

function Sidebar({ open, onClose }) {
  const { hasPerm } = useAuth();
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">C</span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">{APP_NAME}</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group) => {
            // Items without `perm` are always visible; items with `perm` require that permission.
            const items = group.items.filter((item) => !item.perm || hasPerm(item.perm));
            if (!items.length) return null;
            return (
              <div key={group.section} className="mb-5">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.section}</p>
                <ul className="space-y-0.5">
                  {items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`
                        }
                      >
                        {icon(item.icon)}
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  const load = () => {
    api.get('/notifications', { limit: 8 }).then((res) => setItems(res.data)).catch(() => {});
    api.get('/notifications/unread-count').then((res) => setCount(res.data.count)).catch(() => {});
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);   // light polling keeps the badge fresh
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
      >
        {icon('M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9')}
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              <button
                className="text-xs font-medium text-brand-600 hover:underline"
                onClick={async () => { await api.post('/notifications/all/read'); load(); }}
              >
                Mark all read
              </button>
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">You're all caught up</li>}
              {items.map((n) => (
                <li key={n._id}>
                  <button
                    className={`w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? '' : 'bg-brand-50/40'}`}
                    onClick={async () => {
                      await api.post(`/notifications/${n._id}/read`).catch(() => {});
                      setOpen(false);
                      if (n.link) navigate(n.link);
                      load();
                    }}
                  >
                    <p className="text-sm font-medium text-slate-800">{n.title}</p>
                    {n.message && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{fromNow(n.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Topbar({ onMenu }) {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
      <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={onMenu} aria-label="Open menu">
        {icon('M4 6h16M4 12h16M4 18h16')}
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationBell />
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
            <Avatar name={user?.fullName} url={user?.avatarUrl} />
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-slate-800">{user?.fullName}</span>
              <span className="block text-[11px] leading-tight text-slate-500">{ROLE_LABEL[user?.role] || user?.role}</span>
            </span>
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <div className="border-b border-slate-100 px-4 py-2.5">
                  <p className="truncate text-sm font-medium text-slate-800">{user?.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenu(false); navigate('/profile'); }}>
                  My profile
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setMenu(false); navigate('/change-password'); }}>
                  Change password
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={async () => { await logout(); navigate('/login'); }}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
