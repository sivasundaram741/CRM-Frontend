import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useList, useFetch, useUsers, useMasterNames, useMutation } from '../hooks/useApi.js';
import { api } from '../lib/api.js';
import DataTable from '../components/DataTable.jsx';
import RecordForm from '../components/RecordForm.jsx';
import {
  PageHeader, Badge, Avatar, Modal, Field, Select, UserSelect, DatePicker, Tabs, Loading, ErrorState,
  DetailGrid, EmptyState, Toast, ConfirmDialog, Spinner,
} from '../components/ui.jsx';
import TrackingPanel from '../components/TrackingPanel.jsx';
import AttachmentsPanel from '../components/AttachmentsPanel.jsx';
import ImportModal from '../components/ImportModal.jsx';
import { money, date, dateTime, fromNow, nameOf, statusClass } from '../lib/format.js';
import { useAuth, GROUPS } from '../lib/auth.jsx';

// Fallbacks only - live options come from the master lists managed in Settings.
const LEAD_STATUS = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const RATINGS = ['Hot', 'Warm', 'Cold'];

const leadFields = ({ sources, industries, statuses, priorities, ratings }) => [
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Last name' },
  { name: 'companyName', label: 'Company' },
  { name: 'designation', label: 'Designation' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'source', label: 'Source', type: 'select', options: sources },
  { name: 'industry', label: 'Industry', type: 'select', options: industries },
  { name: 'status', label: 'Status', type: 'select', options: statuses },
  { name: 'priority', label: 'Priority', type: 'select', options: priorities },
  { name: 'rating', label: 'Rating', type: 'select', options: ratings },
  { name: 'assignedTo', label: 'Assigned to', type: 'user', showWorkload: true, defaultToMe: true },
  { name: 'expectedRevenue', label: 'Expected revenue', type: 'money', min: 0 },
  { name: 'expectedCloseDate', label: 'Expected close date', type: 'date' },
  { name: 'nextFollowUpAt', label: 'Next follow-up', type: 'date' },
  { name: 'website', label: 'Website' },
  { name: 'description', label: 'Notes', type: 'textarea', span: 2 },
];

// ---------------------------------------------------------------- List

export function LeadList() {
  const [params, setParams] = useSearchParams();
  const list = useList('/leads');
  const users = useUsers();
  const sources = useMasterNames('lead-source');
  const industries = useMasterNames('industry');
  const statuses = useMasterNames('lead-status', LEAD_STATUS);
  const priorities = useMasterNames('priority', PRIORITIES);
  const ratings = useMasterNames('lead-rating', RATINGS);
  const { can } = useAuth();
  const [form, setForm] = useState(params.get('new') ? {} : null);
  const [selection, setSelection] = useState([]);
  const [bulk, setBulk] = useState(false);
  const [dupes, setDupes] = useState(false);
  const [toast, setToast] = useState('');

  const canWrite = can(GROUPS.SALES);

  const columns = [
    { key: 'firstName', label: 'Lead', sortable: true, render: (r) => (
      <span>
        <span className="font-medium">{r.firstName} {r.lastName}</span>
        <span className="block text-xs text-slate-400">{r.leadNumber}</span>
      </span>
    ), exportValue: (r) => `${r.firstName} ${r.lastName}` },
    { key: 'companyName', label: 'Company', sortable: true },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'source', label: 'Source', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
    { key: 'priority', label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
    { key: 'score', label: 'Score', sortable: true, render: (r) => (
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-brand-500" style={{ width: `${r.score}%` }} />
        </span>
        <span className="tabular-nums text-xs text-slate-500">{r.score}</span>
      </span>
    ), exportValue: (r) => r.score },
    { key: 'expectedRevenue', label: 'Value', sortable: true, className: 'text-right', render: (r) => <span className="tabular-nums">{money(r.expectedRevenue)}</span> },
    { key: 'assignedTo', label: 'Owner', render: (r) => (
      <span className="inline-flex items-center gap-2">
        <Avatar name={nameOf(r.assignedTo)} url={r.assignedTo?.avatarUrl} size="h-6 w-6" />
        <span className="text-xs">{nameOf(r.assignedTo)}</span>
      </span>
    ), exportValue: (r) => nameOf(r.assignedTo) },
    { key: 'createdAt', label: 'Created', sortable: true, render: (r) => date(r.createdAt) },
  ];

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Capture, qualify and convert prospects."
        actions={
          <>
            <button className="btn-ghost btn-sm" onClick={() => setDupes(true)}>Find duplicates</button>
            {canWrite && <ImportLeads onDone={(msg) => { setToast(msg); list.refresh(); }} />}
            {canWrite && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New lead</button>}
          </>
        }
      />

      <DataTable
        list={list}
        columns={columns}
        title="leads"
        exportName="leads"
        rowLink={(r) => `/leads/${r._id}`}
        selectable={canWrite}
        onSelectionChange={setSelection}
        emptyTitle="No leads yet"
        emptyHint="Create your first lead or import a list to get started."
        actions={selection.length > 0 && canWrite ? <button className="btn-ghost btn-sm" onClick={() => setBulk(true)}>Bulk update ({selection.length})</button> : null}
        filters={[
          { key: 'status', label: 'All statuses', options: statuses },
          { key: 'priority', label: 'All priorities', options: priorities },
          { key: 'source', label: 'All sources', options: sources },
          { key: 'assignedTo', label: 'All owners', type: 'user' },
        ]}
      />

      <RecordForm
        open={!!form}
        onClose={() => { setForm(null); if (params.get('new')) setParams({}); }}
        onSaved={() => { list.refresh(); setToast('Lead created'); }}
        title="New lead"
        endpoint="/leads"
        record={form}
        fields={leadFields({ sources, industries, statuses, priorities, ratings })}
        defaults={{ status: statuses[0], priority: 'Medium', rating: 'Warm', source: sources[0] }}
      />

      <BulkUpdate open={bulk} onClose={() => setBulk(false)} ids={selection} users={users} onDone={(msg) => { setToast(msg); list.refresh(); setSelection([]); }} />
      <DuplicatesModal open={dupes} onClose={() => setDupes(false)} onMerged={() => { list.refresh(); setToast('Leads merged'); }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

/**
 * The response clock the ingest pipeline stamped at assignment.
 *
 * Shown only where it applies: a lead with no deadline, or one already
 * answered, gets no card rather than a row saying nothing.
 */
function SlaCard({ lead }) {
  if (!lead.slaDueAt) return null;

  const due = new Date(lead.slaDueAt);
  const responded = lead.firstRespondedAt ? new Date(lead.firstRespondedAt) : null;
  const breached = lead.slaBreachedAt || (!responded && due < new Date());

  const state = responded
    ? (responded <= due
      ? { text: 'Answered within the window', tone: 'bg-emerald-100 text-emerald-700' }
      : { text: 'Answered late', tone: 'bg-amber-100 text-amber-700' })
    : breached
      ? { text: `Overdue ${fromNow(due)}`, tone: 'bg-rose-100 text-rose-700' }
      : { text: `Due ${fromNow(due)}`, tone: 'bg-sky-100 text-sky-700' };

  return (
    <div className="card-pad">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Response time</h3>
        <span className={`chip ${state.tone}`}>{state.text}</span>
      </div>
      <dl className="divide-y divide-slate-100 text-sm">
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-xs uppercase tracking-wide text-slate-400">Due by</dt>
          <dd className="text-slate-800">{dateTime(lead.slaDueAt)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-xs uppercase tracking-wide text-slate-400">First reply</dt>
          <dd className={responded ? 'text-slate-800' : 'text-amber-600'}>
            {responded ? dateTime(lead.firstRespondedAt) : 'Awaiting'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * Replies over WhatsApp without leaving the record.
 *
 * Answering in a separate app leaves nothing logged and the service level
 * unsatisfied on paper even when the customer was answered, so the send, the
 * timeline entry and the clock all happen together here.
 */
function WhatsAppReply({ lead, canWrite, onSent }) {
  const { data } = useFetch('/leads/whatsapp/status');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(null);
  const { run, pending, error } = useMutation();

  // Hidden entirely unless it can actually send — an inert box invites a reply
  // that silently goes nowhere.
  if (!data?.ready || !canWrite) return null;
  const to = lead.mobile || lead.phone;
  if (!to) return null;

  const send = async () => {
    try {
      const res = await run((a) => a.post(`/leads/${lead._id}/whatsapp`, { message: message.trim() }));
      setSent(res.data);
      setMessage('');
      onSent?.();
    } catch { /* shown below */ }
  };

  return (
    <div className="card-pad">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Reply on WhatsApp</h3>
      <p className="mb-3 text-xs text-slate-500">To {to} · logged on the timeline</p>

      {error && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {sent && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Sent.</p>}

      <textarea
        className="input" rows={3} placeholder="Type a reply…"
        value={message} onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400">Ctrl + Enter to send</span>
        <button className="btn-primary btn-sm" onClick={send} disabled={pending || !message.trim()}>
          {pending ? <Spinner className="h-4 w-4" /> : 'Send'}
        </button>
      </div>
    </div>
  );
}

function ImportLeads({ onDone }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost btn-sm" onClick={() => setOpen(true)}>Import</button>
      <ImportModal open={open} onClose={() => setOpen(false)} endpoint="/leads" label="leads" onDone={onDone} />
    </>
  );
}

function BulkUpdate({ open, onClose, ids, users, onDone }) {
  const statuses = useMasterNames('lead-status', LEAD_STATUS);
  const priorities = useMasterNames('priority', PRIORITIES);
  const [patch, setPatch] = useState({});
  const { run, pending, error, setError } = useMutation();

  const submit = async () => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v));
    if (!Object.keys(clean).length) return setError('Pick at least one field to change.');
    try {
      const res = await run((a) => a.patch('/leads/bulk', { ids, patch: clean }));
      onDone(`${res.data.modified} lead(s) updated`);
      onClose();
    } catch { /* message shown in the modal */ }
  };

  return (
    <Modal
      open={open} onClose={onClose} title={`Bulk update ${ids.length} lead(s)`} width="max-w-lg"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={pending}>Apply</button></>}
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <Field label="Status"><Select options={statuses} value={patch.status || ''} onChange={(e) => setPatch({ ...patch, status: e.target.value })} placeholder="Leave unchanged" /></Field>
        <Field label="Priority"><Select options={priorities} value={patch.priority || ''} onChange={(e) => setPatch({ ...patch, priority: e.target.value })} placeholder="Leave unchanged" /></Field>
        <Field label="Assign to"><UserSelect users={users} value={patch.assignedTo || ''} onChange={(e) => setPatch({ ...patch, assignedTo: e.target.value })} placeholder="Leave unchanged" /></Field>
      </div>
    </Modal>
  );
}

function DuplicatesModal({ open, onClose, onMerged }) {
  const { data, loading, refresh } = useFetch(open ? '/leads/duplicates' : null);
  const { run, pending, error } = useMutation();

  const merge = async (group) => {
    const [primary, ...rest] = group.leads;
    try {
      await run((a) => a.post('/leads/merge', { primaryId: primary._id, duplicateIds: rest.map((l) => l._id) }));
      refresh();
      onMerged();
    } catch { /* message shown in the modal */ }
  };

  return (
    <Modal open={open} onClose={onClose} title="Duplicate leads" width="max-w-3xl">
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {loading && <Loading />}
      {!loading && (!data || data.length === 0) && <EmptyState title="No duplicates found" hint="Leads are matched on email, phone or company name." />}
      <div className="space-y-4">
        {data?.map((group) => (
          <div key={group._id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">{group.count} matches on <span className="font-mono text-xs">{group._id}</span></p>
              <button className="btn-ghost btn-sm" onClick={() => merge(group)} disabled={pending}>Merge into oldest</button>
            </div>
            <ul className="space-y-1 text-sm text-slate-600">
              {group.leads.map((l, i) => (
                <li key={l._id} className="flex items-center gap-2">
                  <span className={`chip ${i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{i === 0 ? 'primary' : 'duplicate'}</span>
                  <Link to={`/leads/${l._id}`} className="text-brand-700 hover:underline">{l.firstName} {l.lastName}</Link>
                  <span className="text-xs text-slate-400">{l.companyName} · {l.email || l.phone} · {date(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Detail

export function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const users = useUsers();
  const sources = useMasterNames('lead-source');
  const industries = useMasterNames('industry');
  const statuses = useMasterNames('lead-status', LEAD_STATUS);
  const priorities = useMasterNames('priority', PRIORITIES);
  const ratings = useMasterNames('lead-rating', RATINGS);

  const { data, loading, error, refresh } = useFetch(`/leads/${id}/timeline`);
  const [tab, setTab] = useState('general');
  const [edit, setEdit] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [convertModal, setConvertModal] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const { lead, events, counts } = data;
  const canWrite = can(GROUPS.SALES);
  const activities = events.filter((e) => e.kind === 'activity');
  const notes = events.filter((e) => e.kind === 'note');

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/leads" className="hover:underline">Leads</Link>}
        title={`${lead.firstName} ${lead.lastName || ''}`.trim()}
        subtitle={`${lead.leadNumber} · ${lead.companyName || 'No company'}`}
        actions={
          <>
            {canWrite && !lead.isConverted && <button className="btn-ghost btn-sm" onClick={() => setStatusModal(true)}>Change status</button>}
            {canWrite && <button className="btn-ghost btn-sm" onClick={() => setLogModal(true)}>Log activity</button>}
            {canWrite && <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}>Edit</button>}
            {canWrite && !lead.isConverted && <button className="btn-primary btn-sm" onClick={() => setConvertModal(true)}>Convert</button>}
            {canWrite && <button className="btn-ghost btn-sm text-rose-600" onClick={() => setConfirmDelete(true)}>Delete</button>}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge>{lead.status}</Badge>
        <Badge>{lead.priority}</Badge>
        <Badge>{lead.rating}</Badge>
        {lead.isConverted && <span className="chip bg-indigo-100 text-indigo-700">Converted</span>}
        <span className="text-sm text-slate-500">Score <span className="font-semibold text-slate-800">{lead.score}</span>/100</span>
        <span className="text-sm text-slate-500">· Owner {nameOf(lead.assignedTo)}</span>
      </div>

      <Tabs
        tabs={[
          { key: 'general', label: 'General' },
          { key: 'activities', label: 'Activities', count: counts.activities },
          { key: 'notes', label: 'Notes', count: counts.notes },
          { key: 'files', label: 'Files' },
          { key: 'quotations', label: 'Quotations', count: counts.quotations },
          { key: 'tracking', label: 'Tracking' },
          { key: 'timeline', label: 'Timeline' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'general' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="card-pad lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-slate-900">Lead information</h3>
            <DetailGrid
              items={[
                { label: 'Lead number', value: lead.leadNumber },
                { label: 'Full name', value: `${lead.firstName} ${lead.lastName || ''}` },
                { label: 'Designation', value: lead.designation },
                { label: 'Company', value: lead.companyName },
                { label: 'Email', value: lead.email ? <a className="text-brand-700 hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : '—' },
                { label: 'Phone', value: lead.phone ? <a className="text-brand-700 hover:underline" href={`tel:${lead.phone}`}>{lead.phone}</a> : '—' },
                { label: 'Website', value: lead.website },
                { label: 'Source', value: lead.source },
                { label: 'Industry', value: lead.industry },
                { label: 'Expected revenue', value: money(lead.expectedRevenue) },
                { label: 'Expected close', value: date(lead.expectedCloseDate) },
                { label: 'Next follow-up', value: date(lead.nextFollowUpAt) },
                { label: 'Last contacted', value: lead.lastContactedAt ? fromNow(lead.lastContactedAt) : 'Never' },
                { label: 'Created', value: dateTime(lead.createdAt) },
                // Only leads that arrived from an outside channel carry these,
                // so a manually keyed lead is not padded with empty rows.
                lead.channel && { label: 'Channel', value: <span className="capitalize">{lead.channel}</span> },
                lead.sourceRef && { label: 'Campaign / ad', value: lead.sourceDetail || lead.sourceRef },
                lead.brand && { label: 'Brand', value: lead.brand },
                lead.team && { label: 'Team', value: lead.team },
                lead.lostReason && { label: 'Lost reason', value: lead.lostReason },
              ]}
            />
            {lead.description && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{lead.description}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card-pad">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Pipeline progress</h3>
              <ol className="space-y-2">
                {LEAD_STATUS.slice(0, 5).map((s, i) => {
                  const reached = LEAD_STATUS.indexOf(lead.status) >= i;
                  return (
                    <li key={s} className="flex items-center gap-2.5 text-sm">
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${reached ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>
                      <span className={reached ? 'font-medium text-slate-800' : 'text-slate-400'}>{s}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <SlaCard lead={lead} />
            <WhatsAppReply lead={lead} canWrite={canWrite} onSent={refresh} />
            {lead.isConverted && (
              <div className="card-pad">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Converted records</h3>
                <div className="space-y-2 text-sm">
                  {lead.convertedCustomer && <Link className="block text-brand-700 hover:underline" to={`/customers/${lead.convertedCustomer}`}>View customer →</Link>}
                  {lead.convertedOpportunity && <Link className="block text-brand-700 hover:underline" to="/pipeline">View opportunity →</Link>}
                  <p className="text-xs text-slate-500">Converted {fromNow(lead.convertedAt)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'activities' && <ActivityList events={activities} emptyHint="Log a call, meeting or email to build the history." />}
      {tab === 'notes' && <NotesPanel entityType="Lead" entityId={id} onChange={refresh} />}
      {tab === 'files' && <AttachmentsPanel entityType="Lead" entityId={id} readOnly={!canWrite} />}
      {tab === 'quotations' && (
        <div className="table-wrap">
          {events.filter((e) => e.kind === 'quotation').length === 0
            ? <EmptyState title="No quotations" hint="Raise a quotation from the Quotations screen and link it to this lead." />
            : (
              <table className="min-w-full">
                <thead className="bg-slate-50"><tr><th className="th">Quotation</th><th className="th">Status</th><th className="th text-right">Amount</th><th className="th">Date</th></tr></thead>
                <tbody>
                  {events.filter((e) => e.kind === 'quotation').map((q) => (
                    <tr key={q.id} className="row">
                      <td className="td"><Link className="font-medium text-brand-700 hover:underline" to={`/quotations/${q.id}`}>{q.title}</Link></td>
                      <td className="td"><Badge>{q.status}</Badge></td>
                      <td className="td text-right tabular-nums">{money(q.amount)}</td>
                      <td className="td">{date(q.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      )}
      {tab === 'tracking' && <TrackingPanel entityType="Lead" entityId={id} />}
      {tab === 'timeline' && <Timeline events={events} />}

      <RecordForm
        open={edit} onClose={() => setEdit(false)} onSaved={() => { refresh(); setToast('Lead updated'); }}
        title="Edit lead" endpoint="/leads" record={lead} fields={leadFields({ sources, industries, statuses, priorities, ratings })}
      />
      <StatusModal open={statusModal} onClose={() => setStatusModal(false)} lead={lead} onDone={() => { refresh(); setToast('Status updated'); }} />
      <ConvertModal open={convertModal} onClose={() => setConvertModal(false)} lead={lead} users={users}
        onDone={(customerId) => { setToast('Lead converted'); navigate(`/customers/${customerId}`); }} />
      <LogActivityModal open={logModal} onClose={() => setLogModal(false)} relatedTo="Lead" relatedId={id}
        relatedLabel={`${lead.firstName} ${lead.lastName || ''}`} onDone={() => { refresh(); setToast('Activity logged'); }} />
      <ConfirmDialog
        open={confirmDelete} onClose={() => setConfirmDelete(false)} danger confirmLabel="Delete lead"
        title="Delete this lead?" message="The lead is archived, not permanently removed. Related activities stay intact."
        onConfirm={async () => { await api.del(`/leads/${id}`); navigate('/leads'); }}
      />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function StatusModal({ open, onClose, lead, onDone }) {
  const statuses = useMasterNames('lead-status', LEAD_STATUS);
  const lostReasons = useMasterNames('lost-reason', ['Price', 'Chose competitor', 'No response', 'Other']);
  const [status, setStatus] = useState(lead.status);
  const [note, setNote] = useState('');
  const { run, pending, error } = useMutation();

  const submit = async () => {
    try {
      await run((a) => a.post(`/leads/${lead._id}/status`, { status, note, lostReason: status === 'Lost' ? note : undefined }));
      onDone();
      onClose();
    } catch { /* message shown in the modal */ }
  };

  return (
    <Modal open={open} onClose={onClose} title="Change lead status" width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={pending}>Update</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <Field label="New status"><Select options={statuses} value={status} onChange={(e) => setStatus(e.target.value)} placeholder={null} /></Field>
        {status === 'Lost' ? (
          <Field label="Reason for loss" hint="Configured under Settings -> Master data -> Lost reasons.">
            <Select options={lostReasons} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        ) : (
          <Field label="Note (optional)">
            <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function ConvertModal({ open, onClose, lead, users, onDone }) {
  const [form, setForm] = useState({
    createCompany: true, createOpportunity: true,
    opportunityName: `${lead.companyName || lead.firstName} — new opportunity`,
    amount: lead.expectedRevenue || 0, stage: 'Qualified',
    expectedCloseDate: lead.expectedCloseDate?.slice(0, 10) || '',
    accountManager: lead.assignedTo?._id || lead.assignedTo || '',
  });
  const { run, pending, error } = useMutation();

  const submit = async () => {
    try {
      const res = await run((a) => a.post(`/leads/${lead._id}/convert`, form));
      onDone(res.data.customer._id);
      onClose();
    } catch { /* message shown in the modal */ }
  };

  return (
    <Modal open={open} onClose={onClose} title="Convert lead"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={pending}>{pending ? <Spinner className="h-4 w-4" /> : 'Convert lead'}</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <p className="mb-4 text-sm text-slate-600">
        This creates a customer and a primary contact from the lead, and moves its activities, notes and quotations across.
      </p>
      <div className="space-y-4">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.createCompany} onChange={(e) => setForm({ ...form, createCompany: e.target.checked })} />
          Also create a company record{lead.companyName ? ` for “${lead.companyName}”` : ''}
        </label>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.createOpportunity} onChange={(e) => setForm({ ...form, createOpportunity: e.target.checked })} />
          Open an opportunity in the pipeline
        </label>

        {form.createOpportunity && (
          <div className="grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
            <Field label="Opportunity name" className="sm:col-span-2">
              <input className="input" value={form.opportunityName} onChange={(e) => setForm({ ...form, opportunityName: e.target.value })} />
            </Field>
            <Field label="Deal value"><input className="input" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.valueAsNumber || 0 })} /></Field>
            <Field label="Stage"><Select options={['New', 'Qualified', 'Proposal', 'Negotiation']} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} placeholder={null} /></Field>
            <Field label="Expected close date"><DatePicker value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} /></Field>
            <Field label="Account manager">
              <UserSelect users={users} value={form.accountManager} onChange={(e) => setForm({ ...form, accountManager: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- shared panels (reused by customers, deals, tickets)

export function LogActivityModal({ open, onClose, relatedTo, relatedId, relatedLabel, onDone }) {
  const users = useUsers();
  const activityTypes = useMasterNames('activity-type', ['Phone Call', 'Meeting', 'Email', 'SMS', 'WhatsApp', 'Visit', 'Demo', 'Follow-up']);
  const activityStatuses = useMasterNames('activity-status', ['Planned', 'In Progress', 'Completed', 'Cancelled']);
  const [form, setForm] = useState({ type: 'Phone Call', subject: '', description: '', status: 'Completed', startAt: new Date().toISOString().slice(0, 16) });
  const { run, pending, error } = useMutation();

  const submit = async () => {
    try {
      await run((a) => a.post('/activities', { ...form, relatedTo, relatedId, relatedLabel }));
      onDone();
      onClose();
    } catch { /* message shown in the modal */ }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log activity"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit} disabled={pending}>Save</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type"><Select options={activityTypes} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder={null} /></Field>
        <Field label="Status"><Select options={activityStatuses} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} placeholder={null} /></Field>
        <Field label="Subject" className="sm:col-span-2"><input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Intro call with the procurement team" /></Field>
        <Field label="When"><DatePicker withTime value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} /></Field>
        <Field label="Assign to"><UserSelect users={users} value={form.assignedTo || ''} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Me" /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function NotesPanel({ entityType, entityId, onChange }) {
  const { data, loading, refresh } = useFetch('/notes', { entityType, entityId });
  const [text, setText] = useState('');
  const { run, pending, error, setError } = useMutation();

  const add = async () => {
    if (!text.trim()) return;
    try {
      await run((a) => a.post('/notes', { entityType, entityId, content: text.trim() }));
      setText('');
      refresh();
      onChange?.();
    } catch { /* message shown above the composer */ }
  };

  const removeNote = async (noteId) => {
    try {
      await api.del(`/notes/${noteId}`);
      refresh();
      onChange?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</p>}
      <div className="card-pad">
        <textarea className="input" rows={3} placeholder="Add a note…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 flex justify-end">
          <button className="btn-primary btn-sm" onClick={add} disabled={pending || !text.trim()}>Add note</button>
        </div>
      </div>
      {loading && <Loading />}
      {!loading && data?.length === 0 && <div className="card-pad"><EmptyState title="No notes yet" /></div>}
      <ul className="space-y-3">
        {data?.map((n) => (
          <li key={n._id} className="card-pad">
            <div className="mb-1.5 flex items-center gap-2">
              <Avatar name={nameOf(n.createdBy)} size="h-6 w-6" />
              <span className="text-sm font-medium text-slate-800">{nameOf(n.createdBy)}</span>
              <span className="text-xs text-slate-400">{fromNow(n.createdAt)}</span>
              <button className="ml-auto text-xs text-slate-400 hover:text-rose-600" onClick={() => removeNote(n._id)}>
                Delete
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{n.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActivityList({ events, emptyHint }) {
  if (!events.length) return <div className="card-pad"><EmptyState title="No activities yet" hint={emptyHint} /></div>;
  return (
    <ul className="space-y-2.5">
      {events.map((e) => (
        <li key={e.id} className="card-pad flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700">
            {(e.subtype || e.title || '?').slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-slate-800">{e.title}</p>
              {e.status && <Badge>{e.status}</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{e.subtype ? `${e.subtype} · ` : ''}{dateTime(e.at)}{e.by ? ` · ${nameOf(e.by)}` : ''}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Timeline({ events }) {
  if (!events?.length) return <div className="card-pad"><EmptyState title="Nothing recorded yet" /></div>;
  const tone = { activity: 'bg-brand-500', note: 'bg-amber-500', quotation: 'bg-violet-500', history: 'bg-slate-400', created: 'bg-emerald-500', invoice: 'bg-sky-500', ticket: 'bg-rose-500', deal: 'bg-indigo-500' };
  return (
    <ol className="relative ml-3 border-l border-slate-200">
      {events.map((e, i) => (
        <li key={`${e.kind}-${e.id || i}`} className="mb-5 ml-6">
          <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-slate-100 ${tone[e.kind] || 'bg-slate-400'}`} />
          <div className="card-pad">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-slate-100 text-slate-600">{e.kind}</span>
              <p className="text-sm font-medium text-slate-800">{e.title}</p>
              {e.status && <Badge>{e.status}</Badge>}
              {e.amount != null && <span className="text-sm tabular-nums text-slate-600">{money(e.amount)}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{dateTime(e.at)}{e.by ? ` · ${nameOf(e.by)}` : ''}{e.note ? ` · ${e.note}` : ''}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
