import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useList, useFetch, useMasterNames, useCurrencyCodes, useMutation } from '../hooks/useApi.js';
import DataTable from '../components/DataTable.jsx';
import RecordForm from '../components/RecordForm.jsx';
import {
  PageHeader, Badge, Avatar, Tabs, Loading, ErrorState, DetailGrid, EmptyState, Toast, errorToast,
  Modal, Field, Spinner,
} from '../components/ui.jsx';
import { NotesPanel, Timeline, LogActivityModal } from './Leads.jsx';
import TrackingPanel from '../components/TrackingPanel.jsx';
import AttachmentsPanel from '../components/AttachmentsPanel.jsx';
import { money, date, nameOf, percent } from '../lib/format.js';
import { useAuth, GROUPS } from '../lib/auth.jsx';

// Fallbacks only - live options come from the master lists in Settings.
const CUSTOMER_STATUS = ['Prospect', 'Active', 'Inactive', 'Churned'];
const RELATIONSHIPS = ['Decision Maker', 'Influencer', 'Gatekeeper', 'Champion', 'Contact'];

const customerFields = ({ industries, statuses, currencies }) => [
  { name: 'name', label: 'Customer name', required: true, span: 2 },
  { name: 'type', label: 'Type', type: 'select', options: ['Business', 'Individual'] },
  { name: 'status', label: 'Status', type: 'select', options: statuses },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'website', label: 'Website' },
  { name: 'industry', label: 'Industry', type: 'select', options: industries },
  { name: 'taxNumber', label: 'Tax number' },
  { name: 'currency', label: 'Currency', type: 'select', options: currencies },
  { name: 'creditLimit', label: 'Credit limit', type: 'money', min: 0 },
  { name: 'paymentTermsDays', label: 'Payment terms (days)', type: 'number', min: 0 },
  { name: 'accountManager', label: 'Account manager', type: 'user', defaultToMe: true },
  { name: 'description', label: 'Notes', type: 'textarea', span: 2 },
];

const companyFields = (industries) => [
  { name: 'name', label: 'Company name', required: true, span: 2 },
  { name: 'legalName', label: 'Legal name' },
  { name: 'industry', label: 'Industry', type: 'select', options: industries },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'website', label: 'Website' },
  { name: 'employeeCount', label: 'Employees', type: 'number', min: 0 },
  { name: 'annualRevenue', label: 'Annual revenue', type: 'money', min: 0 },
  { name: 'taxNumber', label: 'Tax number' },
  { name: 'owner', label: 'Owner', type: 'user', defaultToMe: true },
  { name: 'description', label: 'Description', type: 'textarea', span: 2 },
];

const contactFields = ({ relationships, companies, customers }) => [
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Last name' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'mobile', label: 'Mobile', type: 'tel' },
  { name: 'designation', label: 'Designation' },
  { name: 'company', label: 'Company', type: 'select', options: companies.map((c) => ({ value: c._id, label: c.name })) },
  { name: 'customer', label: 'Customer account', type: 'select', options: customers.map((c) => ({ value: c._id, label: c.name })) },
  { name: 'relationship', label: 'Relationship', type: 'select', options: relationships },
  { name: 'linkedIn', label: 'LinkedIn' },
  { name: 'birthday', label: 'Birthday', type: 'date' },
  { name: 'owner', label: 'Owner', type: 'user', defaultToMe: true },
  { name: 'isPrimary', label: 'Primary contact for this account', type: 'checkbox', span: 2 },
  { name: 'description', label: 'Notes', type: 'textarea', span: 2 },
];

// ---------------------------------------------------------------- Customers

export function CustomerList() {
  const list = useList('/customers');
  const industries = useMasterNames('industry');
  const statuses = useMasterNames('customer-status', CUSTOMER_STATUS);
  const currencies = useCurrencyCodes();
  const { can } = useAuth();
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Accounts you have won, with their revenue and open balances."
        actions={can(GROUPS.SALES) && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New customer</button>}
      />
      <DataTable
        list={list}
        title="customers"
        exportName="customers"
        rowLink={(r) => `/customers/${r._id}`}
        emptyTitle="No customers yet"
        emptyHint="Convert a qualified lead, or add a customer directly."
        filters={[
          { key: 'status', label: 'All statuses', options: statuses },
          { key: 'type', label: 'All types', options: ['Business', 'Individual'] },
          { key: 'accountManager', label: 'All managers', type: 'user' },
        ]}
        columns={[
          { key: 'name', label: 'Customer', sortable: true, render: (r) => (
            <span><span className="font-medium">{r.name}</span><span className="block text-xs text-slate-400">{r.customerNumber}</span></span>
          ) },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'industry', label: 'Industry' },
          { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
          { key: 'totalRevenue', label: 'Revenue', sortable: true, className: 'text-right', render: (r) => <span className="tabular-nums">{money(r.totalRevenue, r.currency)}</span> },
          { key: 'outstandingAmount', label: 'Outstanding', sortable: true, className: 'text-right', render: (r) => (
            <span className={`tabular-nums ${r.outstandingAmount > 0 ? 'font-medium text-rose-600' : 'text-slate-500'}`}>{money(r.outstandingAmount, r.currency)}</span>
          ) },
          { key: 'accountManager', label: 'Manager', render: (r) => nameOf(r.accountManager), exportValue: (r) => nameOf(r.accountManager) },
        ]}
      />
      <RecordForm
        open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); setToast('Customer created'); }}
        title="New customer" endpoint="/customers" record={form}
        fields={customerFields({ industries, statuses, currencies })} defaults={{ type: 'Business', status: statuses[0], currency: 'INR', paymentTermsDays: 30 }}
      />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const industries = useMasterNames('industry');
  const statuses = useMasterNames('customer-status', CUSTOMER_STATUS);
  const currencies = useCurrencyCodes();
  const { data, loading, error, refresh } = useFetch(`/customers/${id}/detail`);
  const timeline = useFetch(`/customers/${id}/timeline`);
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [logging, setLogging] = useState(false);
  const [toast, setToast] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const { customer, contacts, invoices, payments, tickets, opportunities, orders, quotations, summary } = data;

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/customers" className="hover:underline">Customers</Link>}
        title={customer.name}
        subtitle={`${customer.customerNumber} · ${customer.industry || 'No industry'} · customer since ${date(customer.customerSince)}`}
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={() => setLogging(true)}>Log activity</button>
            {can(GROUPS.SALES) && <button className="btn-primary btn-sm" onClick={() => setEdit(true)}>Edit</button>}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ['Lifetime value', money(summary.lifetimeValue, customer.currency)],
          ['Outstanding', money(summary.outstanding, customer.currency)],
          ['Open deals', summary.openDeals],
          ['Won deals', summary.wonDeals],
          ['Open tickets', summary.openTickets],
        ].map(([label, value]) => (
          <div key={label} className="card-pad">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1.5 text-lg font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'contacts', label: 'Contacts', count: contacts.length },
          { key: 'deals', label: 'Deals', count: opportunities.length },
          { key: 'sales', label: 'Quotes & orders', count: quotations.length + orders.length },
          { key: 'invoices', label: 'Invoices', count: invoices.length },
          { key: 'payments', label: 'Payments', count: payments.length },
          { key: 'support', label: 'Support', count: tickets.length },
          { key: 'notes', label: 'Notes' },
          { key: 'files', label: 'Files' },
          { key: 'tracking', label: 'Tracking' },
          { key: 'timeline', label: 'Timeline' },
        ]}
      />

      {tab === 'overview' && (
        <div className="card-pad">
          <DetailGrid
            items={[
              { label: 'Customer number', value: customer.customerNumber },
              { label: 'Type', value: customer.type },
              { label: 'Status', value: <Badge>{customer.status}</Badge> },
              { label: 'Email', value: customer.email },
              { label: 'Phone', value: customer.phone },
              { label: 'Website', value: customer.website },
              { label: 'Industry', value: customer.industry },
              { label: 'Tax number', value: customer.taxNumber },
              { label: 'Currency', value: customer.currency },
              { label: 'Credit limit', value: money(customer.creditLimit, customer.currency) },
              { label: 'Payment terms', value: `${customer.paymentTermsDays} days` },
              { label: 'Account manager', value: nameOf(customer.accountManager) },
              { label: 'Satisfaction', value: customer.satisfactionScore ? `${customer.satisfactionScore} / 5` : '—' },
              { label: 'Billing address', value: [customer.billingAddress?.line1, customer.billingAddress?.city, customer.billingAddress?.state, customer.billingAddress?.postalCode].filter(Boolean).join(', ') || '—' },
            ]}
          />
        </div>
      )}

      {tab === 'contacts' && <SimpleTable rows={contacts} empty="No contacts recorded"
        columns={[['Name', (c) => <Link className="font-medium text-brand-700 hover:underline" to={`/contacts/${c._id}`}>{c.firstName} {c.lastName}</Link>],
          ['Designation', (c) => c.designation || '—'], ['Email', (c) => c.email || '—'], ['Phone', (c) => c.phone || '—'],
          ['Role', (c) => <Badge tone="bg-slate-100 text-slate-700">{c.relationship}</Badge>]]} />}

      {tab === 'deals' && <SimpleTable rows={opportunities} empty="No opportunities"
        columns={[['Opportunity', (o) => o.name], ['Stage', (o) => <Badge>{o.stage}</Badge>],
          ['Value', (o) => money(o.amount, o.currency)], ['Probability', (o) => percent(o.probability)],
          ['Close date', (o) => date(o.expectedCloseDate)]]} />}

      {tab === 'sales' && (
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Quotations</h3>
            <SimpleTable rows={quotations} empty="No quotations"
              columns={[['Number', (q) => <Link className="font-medium text-brand-700 hover:underline" to={`/quotations/${q._id}`}>{q.quotationNumber}</Link>],
                ['Subject', (q) => q.subject], ['Status', (q) => <Badge>{q.status}</Badge>],
                ['Total', (q) => money(q.grandTotal, q.currency)], ['Date', (q) => date(q.quotationDate)]]} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Sales orders</h3>
            <SimpleTable rows={orders} empty="No sales orders"
              columns={[['Number', (o) => o.orderNumber], ['Status', (o) => <Badge>{o.status}</Badge>],
                ['Delivery', (o) => <Badge>{o.deliveryStatus}</Badge>], ['Total', (o) => money(o.grandTotal, o.currency)],
                ['Date', (o) => date(o.orderDate)]]} />
          </div>
        </div>
      )}

      {tab === 'invoices' && <SimpleTable rows={invoices} empty="No invoices"
        columns={[['Invoice', (i) => <Link className="font-medium text-brand-700 hover:underline" to={`/invoices/${i._id}`}>{i.invoiceNumber}</Link>],
          ['Status', (i) => <Badge>{i.status}</Badge>], ['Total', (i) => money(i.grandTotal, i.currency)],
          ['Paid', (i) => money(i.amountPaid, i.currency)], ['Balance', (i) => money(i.balanceDue, i.currency)],
          ['Due', (i) => date(i.dueDate)]]} />}

      {tab === 'payments' && <SimpleTable rows={payments} empty="No payments recorded"
        columns={[['Payment', (p) => p.paymentNumber], ['Mode', (p) => p.mode],
          ['Amount', (p) => <span className={p.isRefund ? 'text-rose-600' : ''}>{p.isRefund ? '−' : ''}{money(p.amount, p.currency)}</span>],
          ['Reference', (p) => p.referenceNumber || '—'], ['Date', (p) => date(p.paidAt)]]} />}

      {tab === 'support' && <SimpleTable rows={tickets} empty="No support tickets"
        columns={[['Ticket', (t) => <Link className="font-medium text-brand-700 hover:underline" to={`/support/${t._id}`}>{t.ticketNumber}</Link>],
          ['Subject', (t) => t.subject], ['Status', (t) => <Badge>{t.status}</Badge>],
          ['Priority', (t) => <Badge>{t.priority}</Badge>], ['Raised', (t) => date(t.createdAt)]]} />}

      {tab === 'notes' && <NotesPanel entityType="Customer" entityId={id} />}
      {tab === 'files' && <AttachmentsPanel entityType="Customer" entityId={id} readOnly={!can(GROUPS.SALES)} />}
      {tab === 'tracking' && <TrackingPanel entityType="Customer" entityId={id} />}
      {tab === 'timeline' && (timeline.loading ? <Loading /> : <Timeline events={timeline.data || []} />)}

      <RecordForm
        open={edit} onClose={() => setEdit(false)} onSaved={() => { refresh(); setToast('Customer updated'); }}
        title="Edit customer" endpoint="/customers" record={customer} fields={customerFields({ industries, statuses, currencies })}
      />
      <LogActivityModal open={logging} onClose={() => setLogging(false)} relatedTo="Customer" relatedId={id}
        relatedLabel={customer.name} onDone={() => { timeline.refresh(); setToast('Activity logged'); }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

/** Compact read-only table used across detail tabs. */
export function SimpleTable({ rows, columns, empty }) {
  if (!rows?.length) return <div className="card-pad"><EmptyState title={empty} /></div>;
  return (
    <div className="table-wrap">
      <table className="min-w-full">
        <thead className="bg-slate-50">
          <tr>{columns.map(([label]) => <th key={label} className="th">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id} className="row">
              {columns.map(([label, render]) => <td key={label} className="td">{render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Companies

export function CompanyList() {
  const list = useList('/companies');
  const industries = useMasterNames('industry');
  const { can } = useAuth();
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  const fields = companyFields(industries);

  return (
    <>
      <PageHeader title="Companies" subtitle="Organisations behind your leads, contacts and customers."
        actions={can(GROUPS.SALES) && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New company</button>} />
      <DataTable
        list={list} title="companies" exportName="companies" rowLink={(r) => `/companies/${r._id}`}
        emptyTitle="No companies yet"
        filters={[
          { key: 'industry', label: 'All industries', options: industries },
          { key: 'owner', label: 'All owners', type: 'user' },
        ]}
        columns={[
          { key: 'name', label: 'Company', sortable: true, render: (r) => (
            <span><span className="font-medium">{r.name}</span><span className="block text-xs text-slate-400">{r.companyNumber}</span></span>
          ) },
          { key: 'industry', label: 'Industry', sortable: true },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'employeeCount', label: 'Employees', sortable: true, className: 'text-right' },
          { key: 'annualRevenue', label: 'Annual revenue', sortable: true, className: 'text-right', render: (r) => money(r.annualRevenue) },
          { key: 'owner', label: 'Owner', render: (r) => nameOf(r.owner), exportValue: (r) => nameOf(r.owner) },
        ]}
      />
      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); setToast('Company created'); }}
        title="New company" endpoint="/companies" record={form} fields={fields} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

export function CompanyDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const industries = useMasterNames('industry');
  const { data, loading, error, refresh } = useFetch(`/companies/${id}/detail`);
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [branchForm, setBranchForm] = useState(null);
  const [toast, setToast] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  const { company, contacts, customers, branches } = data;
  const canWrite = can(GROUPS.SALES);

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/companies" className="hover:underline">Companies</Link>}
        title={company.name}
        subtitle={`${company.companyNumber} · ${company.industry || 'No industry'}`}
        actions={canWrite && <button className="btn-primary btn-sm" onClick={() => setEdit(true)}>Edit</button>}
      />
      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'branches', label: 'Branches', count: branches?.length || 0 },
        { key: 'contacts', label: 'Contacts', count: contacts.length },
        { key: 'customers', label: 'Customers', count: customers.length },
        { key: 'notes', label: 'Notes' },
        { key: 'files', label: 'Files' },
      ]} />

      {tab === 'overview' && (
        <div className="card-pad">
          <DetailGrid items={[
            { label: 'Legal name', value: company.legalName },
            { label: 'Industry', value: company.industry },
            { label: 'Website', value: company.website },
            { label: 'Email', value: company.email },
            { label: 'Phone', value: company.phone },
            { label: 'Employees', value: company.employeeCount },
            { label: 'Annual revenue', value: money(company.annualRevenue) },
            { label: 'Tax number', value: company.taxNumber },
            { label: 'Owner', value: nameOf(company.owner) },
            { label: 'Address', value: [company.address?.line1, company.address?.city, company.address?.state].filter(Boolean).join(', ') || '—' },
          ]} />
        </div>
      )}
      {tab === 'branches' && (
        <>
          {canWrite && (
            <div className="mb-3 flex justify-end">
              <button className="btn-primary btn-sm" onClick={() => setBranchForm({})}>Add branch</button>
            </div>
          )}
          <SimpleTable rows={branches || []} empty="No branches recorded"
            columns={[['Branch', (b) => b.name], ['Head office', (b) => (b.isHeadOffice ? 'Yes' : 'No')],
              ['Phone', (b) => b.phone || '—'], ['Email', (b) => b.email || '—'],
              ['City', (b) => b.address?.city || '—'],
              ['', (b) => (canWrite ? (
                <button className="btn-ghost btn-sm text-rose-600" onClick={async () => {
                  try {
                    await api.del(`/companies/${id}/branches/${b._id}`);
                    refresh();
                    setToast('Branch removed');
                  } catch (err) { setToast(errorToast(err)); }
                }}>Remove</button>
              ) : null)]]} />
        </>
      )}
      {tab === 'contacts' && <SimpleTable rows={contacts} empty="No contacts"
        columns={[['Name', (c) => <Link className="font-medium text-brand-700 hover:underline" to={`/contacts/${c._id}`}>{c.firstName} {c.lastName}</Link>],
          ['Designation', (c) => c.designation || '—'], ['Email', (c) => c.email || '—'], ['Phone', (c) => c.phone || '—']]} />}
      {tab === 'customers' && <SimpleTable rows={customers} empty="No customer accounts"
        columns={[['Customer', (c) => <Link className="font-medium text-brand-700 hover:underline" to={`/customers/${c._id}`}>{c.name}</Link>],
          ['Status', (c) => <Badge>{c.status}</Badge>], ['Revenue', (c) => money(c.totalRevenue)]]} />}
      {tab === 'notes' && <NotesPanel entityType="Company" entityId={id} />}
      {tab === 'files' && <AttachmentsPanel entityType="Company" entityId={id} readOnly={!canWrite} />}

      <RecordForm
        open={edit} onClose={() => setEdit(false)} onSaved={() => { refresh(); setToast('Company updated'); }}
        title="Edit company" endpoint="/companies" record={company} fields={companyFields(industries)}
      />
      <BranchForm
        open={!!branchForm} onClose={() => setBranchForm(null)} companyId={id}
        onSaved={() => { refresh(); setToast('Branch added'); }}
      />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

/** Branches are a sub-document array, so they get their own small form. */
function BranchForm({ open, onClose, companyId, onSaved }) {
  const empty = { name: '', code: '', phone: '', email: '', isHeadOffice: false, city: '', line1: '', state: '', country: '', postalCode: '' };
  const [values, setValues] = useState(empty);
  const { run, pending, error } = useMutation();
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const { line1, city, state, country, postalCode, ...branch } = values;
    try {
      await run((a) => a.post(`/companies/${companyId}/branches`, {
        ...branch,
        address: { line1, city, state, country, postalCode },
      }));
      setValues(empty);
      onSaved();
      onClose();
    } catch {
      // `run` surfaces the message; keep the form open so the entry is not lost.
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add branch"
      footer={<>
        <button type="button" className="btn-ghost" onClick={onClose} disabled={pending}>Cancel</button>
        <button type="submit" form="branch-form" className="btn-primary" disabled={pending}>
          {pending ? <Spinner className="h-4 w-4" /> : 'Add branch'}
        </button>
      </>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <form id="branch-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Branch name" required><input className="input" required value={values.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Code"><input className="input" value={values.code} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Phone"><input className="input" value={values.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" value={values.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Address line" className="sm:col-span-2"><input className="input" value={values.line1} onChange={(e) => set('line1', e.target.value)} /></Field>
        <Field label="City"><input className="input" value={values.city} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="State"><input className="input" value={values.state} onChange={(e) => set('state', e.target.value)} /></Field>
        <Field label="Country"><input className="input" value={values.country} onChange={(e) => set('country', e.target.value)} /></Field>
        <Field label="Postal code"><input className="input" value={values.postalCode} onChange={(e) => set('postalCode', e.target.value)} /></Field>
        <label className="flex items-center gap-2.5 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
            checked={values.isHeadOffice} onChange={(e) => set('isHeadOffice', e.target.checked)} />
          <span className="text-sm text-slate-700">This is the head office</span>
        </label>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Contacts

export function ContactList() {
  const list = useList('/contacts');
  const relationships = useMasterNames('contact-relationship', RELATIONSHIPS);
  const companies = useFetch('/companies', { limit: 200, sort: 'name' });
  const customers = useFetch('/customers', { limit: 200, sort: 'name' });
  const { can } = useAuth();
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  const fields = contactFields({ relationships, companies: companies.data || [], customers: customers.data || [] });

  return (
    <>
      <PageHeader title="Contacts" subtitle="People you deal with, and how they relate to each account."
        actions={can(GROUPS.SALES) && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New contact</button>} />
      <DataTable
        list={list} title="contacts" exportName="contacts" rowLink={(r) => `/contacts/${r._id}`}
        emptyTitle="No contacts yet"
        filters={[
          { key: 'relationship', label: 'All relationships', options: relationships },
          { key: 'owner', label: 'All owners', type: 'user' },
        ]}
        columns={[
          { key: 'firstName', label: 'Name', sortable: true, render: (r) => (
            <span><span className="font-medium">{r.firstName} {r.lastName}</span><span className="block text-xs text-slate-400">{r.contactNumber}</span></span>
          ), exportValue: (r) => `${r.firstName} ${r.lastName}` },
          { key: 'designation', label: 'Designation' },
          { key: 'company', label: 'Company', render: (r) => nameOf(r.company), exportValue: (r) => nameOf(r.company) },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'relationship', label: 'Relationship', render: (r) => <Badge tone="bg-slate-100 text-slate-700">{r.relationship}</Badge> },
          { key: 'owner', label: 'Owner', render: (r) => nameOf(r.owner), exportValue: (r) => nameOf(r.owner) },
        ]}
      />
      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); setToast('Contact created'); }}
        title="New contact" endpoint="/contacts" record={form} fields={fields} defaults={{ relationship: 'Contact' }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

export function ContactDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const relationships = useMasterNames('contact-relationship', RELATIONSHIPS);
  const companies = useFetch('/companies', { limit: 200, sort: 'name' });
  const customers = useFetch('/customers', { limit: 200, sort: 'name' });
  const { data, loading, error, refresh } = useFetch(`/contacts/${id}/history`);
  const [tab, setTab] = useState('overview');
  const [logging, setLogging] = useState(false);
  const [edit, setEdit] = useState(false);
  const [toast, setToast] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  const { contact, activities, relatedContacts } = data;
  const canWrite = can(GROUPS.SALES);

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/contacts" className="hover:underline">Contacts</Link>}
        title={`${contact.firstName} ${contact.lastName || ''}`.trim()}
        subtitle={[contact.designation, nameOf(contact.company)].filter((v) => v && v !== '—').join(' · ')}
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={() => setLogging(true)}>Log activity</button>
            {canWrite && <button className="btn-primary btn-sm" onClick={() => setEdit(true)}>Edit</button>}
          </>
        }
      />
      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'communication', label: 'Communication', count: activities.length },
        { key: 'relationships', label: 'Relationship map', count: relatedContacts.length },
        { key: 'notes', label: 'Notes' },
        { key: 'files', label: 'Files' },
      ]} />

      {tab === 'overview' && (
        <div className="card-pad">
          <DetailGrid items={[
            { label: 'Contact number', value: contact.contactNumber },
            { label: 'Email', value: contact.email },
            { label: 'Phone', value: contact.phone },
            { label: 'Mobile', value: contact.mobile },
            { label: 'Designation', value: contact.designation },
            { label: 'Company', value: contact.company ? <Link className="text-brand-700 hover:underline" to={`/companies/${contact.company._id}`}>{contact.company.name}</Link> : '—' },
            { label: 'Customer', value: contact.customer ? <Link className="text-brand-700 hover:underline" to={`/customers/${contact.customer._id}`}>{contact.customer.name}</Link> : '—' },
            { label: 'Relationship', value: <Badge tone="bg-slate-100 text-slate-700">{contact.relationship}</Badge> },
            { label: 'Primary contact', value: contact.isPrimary ? 'Yes' : 'No' },
            { label: 'LinkedIn', value: contact.linkedIn },
            { label: 'Birthday', value: date(contact.birthday) },
          ]} />
        </div>
      )}

      {tab === 'communication' && <SimpleTable rows={activities} empty="No communication logged"
        columns={[['Type', (a) => a.type], ['Subject', (a) => a.subject], ['Status', (a) => <Badge>{a.status}</Badge>],
          ['Owner', (a) => nameOf(a.assignedTo)], ['When', (a) => date(a.startAt)]]} />}

      {tab === 'relationships' && (
        <div className="card-pad">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Others at this account</h3>
          {relatedContacts.length === 0 ? <EmptyState title="No other contacts at this account" /> : (
            <ul className="space-y-2">
              {relatedContacts.map((c) => (
                <li key={c._id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <Avatar name={`${c.firstName} ${c.lastName || ''}`} size="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <Link className="text-sm font-medium text-brand-700 hover:underline" to={`/contacts/${c._id}`}>{c.firstName} {c.lastName}</Link>
                    <p className="text-xs text-slate-500">{c.designation || 'No designation'}</p>
                  </div>
                  <Badge tone="bg-slate-100 text-slate-700">{c.relationship}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'notes' && <NotesPanel entityType="Contact" entityId={id} />}
      {tab === 'files' && <AttachmentsPanel entityType="Contact" entityId={id} readOnly={!canWrite} />}

      <LogActivityModal open={logging} onClose={() => setLogging(false)} relatedTo="Contact" relatedId={id}
        relatedLabel={`${contact.firstName} ${contact.lastName || ''}`} onDone={refresh} />
      <RecordForm
        open={edit} onClose={() => setEdit(false)} onSaved={() => { refresh(); setToast('Contact updated'); }}
        title="Edit contact" endpoint="/contacts" record={contact}
        fields={contactFields({ relationships, companies: companies.data || [], customers: customers.data || [] })}
      />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}
