import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useList, useFetch, useUsers, useMasterNames, useMutation } from '../hooks/useApi.js';
import DataTable from '../components/DataTable.jsx';
import RecordForm from '../components/RecordForm.jsx';
import {
  PageHeader, Badge, Avatar, Loading, ErrorState, EmptyState, Toast, Modal, Field, UserSelect,
  Tabs, Spinner,
} from '../components/ui.jsx';
import TrackingPanel from '../components/TrackingPanel.jsx';
import AttachmentsPanel from '../components/AttachmentsPanel.jsx';
import { date, dateTime, fromNow, nameOf } from '../lib/format.js';
import { useAuth, GROUPS } from '../lib/auth.jsx';

// Fallbacks only - live options come from the master lists in Settings.
const TICKET_STATUS = ['Open', 'In Progress', 'Waiting on Customer', 'Escalated', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const CHANNELS = ['Email', 'Phone', 'Portal', 'Chat', 'WhatsApp'];
const CATEGORIES = ['Technical', 'Billing', 'Feature Request', 'General'];

export function TicketList() {
  const [tab, setTab] = useState('tickets');
  const list = useList('/tickets');
  const kb = useList('/knowledge-base');
  const users = useUsers();
  const statuses = useMasterNames('ticket-status', TICKET_STATUS);
  const priorities = useMasterNames('priority', PRIORITIES);
  const channels = useMasterNames('ticket-channel', CHANNELS);
  const categories = useMasterNames('ticket-category', CATEGORIES);
  const customers = useFetch('/customers', { limit: 200, sort: 'name' });
  const { user, can } = useAuth();
  const [form, setForm] = useState(null);
  const [article, setArticle] = useState(null);
  const [toast, setToast] = useState('');

  const isPortal = user?.role === 'Customer';
  const canManage = can(GROUPS.SUPPORT);

  const ticketFields = [
    { name: 'subject', label: 'Subject', required: true, span: 2 },
    { name: 'category', label: 'Category', type: 'select', options: categories },
    { name: 'priority', label: 'Priority', type: 'select', options: priorities },
    ...(isPortal ? [] : [
      { name: 'customer', label: 'Customer', type: 'select', options: (customers.data || []).map((c) => ({ value: c._id, label: c.name })) },
      { name: 'channel', label: 'Channel', type: 'select', options: channels },
      { name: 'assignedTo', label: 'Assign to', type: 'user', showWorkload: true, defaultToMe: true },
      { name: 'status', label: 'Status', type: 'select', options: statuses },
    ]),
    { name: 'description', label: 'Description', type: 'textarea', rows: 5, span: 2, required: true },
  ];

  return (
    <>
      <PageHeader
        title="Support"
        subtitle={isPortal ? 'Raise and follow your support requests.' : 'Tickets, SLAs and the knowledge base.'}
        actions={<button className="btn-primary btn-sm" onClick={() => setForm({})}>New ticket</button>}
      />

      {!isPortal && <Tabs active={tab} onChange={setTab} tabs={[{ key: 'tickets', label: 'Tickets' }, { key: 'kb', label: 'Knowledge base' }]} />}

      {tab === 'tickets' && (
        <DataTable
          list={list} title="tickets" exportName="tickets" rowLink={(r) => `/support/${r._id}`}
          emptyTitle="No tickets" emptyHint={isPortal ? 'Raise a ticket and our team will pick it up.' : 'Nothing needs attention right now.'}
          filters={[
            { key: 'status', label: 'All statuses', options: statuses },
            { key: 'priority', label: 'All priorities', options: priorities },
            ...(isPortal ? [] : [{ key: 'assignedTo', label: 'All agents', type: 'user' }]),
          ]}
          columns={[
            { key: 'ticketNumber', label: 'Ticket', sortable: true },
            { key: 'subject', label: 'Subject', sortable: true, render: (r) => <span className="font-medium text-slate-800">{r.subject}</span> },
            ...(isPortal ? [] : [{ key: 'customer', label: 'Customer', render: (r) => nameOf(r.customer), exportValue: (r) => nameOf(r.customer) }]),
            { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
            { key: 'priority', label: 'Priority', sortable: true, render: (r) => <Badge>{r.priority}</Badge> },
            { key: 'category', label: 'Category' },
            ...(isPortal ? [] : [{ key: 'assignedTo', label: 'Agent', render: (r) => nameOf(r.assignedTo), exportValue: (r) => nameOf(r.assignedTo) }]),
            { key: 'slaDueAt', label: 'SLA due', render: (r) => (
              <span className={r.isSlaBreached ? 'font-medium text-rose-600' : ''}>{dateTime(r.slaDueAt)}</span>
            ) },
            { key: 'createdAt', label: 'Raised', sortable: true, render: (r) => fromNow(r.createdAt) },
          ]}
        />
      )}

      {tab === 'kb' && (
        <DataTable
          list={kb} title="articles" onRowClick={(r) => setArticle(r)}
          emptyTitle="No articles yet"
          actions={canManage && <button className="btn-primary btn-sm" onClick={() => setArticle({})}>New article</button>}
          columns={[
            { key: 'title', label: 'Article', sortable: true, render: (r) => <span className="font-medium">{r.title}</span> },
            { key: 'category', label: 'Category', sortable: true },
            { key: 'isPublished', label: 'Published', render: (r) => <Badge tone={r.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{r.isPublished ? 'Published' : 'Draft'}</Badge> },
            { key: 'viewCount', label: 'Views', sortable: true, className: 'text-right' },
            { key: 'updatedAt', label: 'Updated', sortable: true, render: (r) => date(r.updatedAt) },
          ]}
        />
      )}

      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); setToast('Ticket created'); }}
        title="New support ticket" endpoint="/tickets" record={form} fields={ticketFields}
        defaults={{ priority: 'Medium', category: categories[0], channel: isPortal ? 'Portal' : channels[0], status: statuses[0] }} />

      <RecordForm open={!!article} onClose={() => setArticle(null)} onSaved={() => { kb.refresh(); setToast('Article saved'); }}
        title={article?._id ? 'Edit article' : 'New article'} endpoint="/knowledge-base" record={article}
        fields={[
          { name: 'title', label: 'Title', required: true, span: 2 },
          { name: 'category', label: 'Category', type: 'select', options: ['Onboarding', 'Sales', 'Support', 'Billing', 'General'] },
          { name: 'isPublished', label: 'Published', type: 'checkbox' },
          { name: 'content', label: 'Content', type: 'textarea', rows: 10, span: 2, required: true },
        ]}
        defaults={{ category: 'General' }} />

      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

/**
 * One label/value line in the sidebar.
 *
 * Labels run down the left edge and values are flushed right, so the column
 * reads as a single aligned block. `DetailGrid` stacks the value under its
 * label, which in a narrow sidebar left every value at a different height and
 * the section looking ragged.
 */
function Row({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`min-w-0 break-words text-right text-sm ${tone}`}>{value ?? '—'}</dd>
    </div>
  );
}

/** Time left on the SLA clock, phrased for whichever side of the line it falls. */
function slaState(ticket) {
  if (!ticket.slaDueAt) return null;
  if (ticket.resolvedAt) {
    return ticket.isSlaBreached
      ? { text: 'Resolved past the SLA', tone: 'text-rose-600', chip: 'bg-rose-100 text-rose-700' }
      : { text: 'Resolved within the SLA', tone: 'text-emerald-600', chip: 'bg-emerald-100 text-emerald-700' };
  }
  if (ticket.isSlaBreached) {
    return { text: `Breached ${fromNow(ticket.slaDueAt)}`, tone: 'text-rose-600', chip: 'bg-rose-100 text-rose-700' };
  }
  return { text: `Due ${fromNow(ticket.slaDueAt)}`, tone: 'text-slate-800', chip: 'bg-slate-100 text-slate-600' };
}

export function TicketDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const users = useUsers();
  const { data, loading, error, refresh } = useFetch(`/tickets/${id}/detail`);
  const [tab, setTab] = useState('conversation');
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [rating, setRating] = useState(false);
  const [toast, setToast] = useState('');
  const { run, pending, error: replyError } = useMutation();

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data?.ticket) return <ErrorState message="This ticket could not be loaded." onRetry={refresh} />;

  const { ticket, replies } = data;
  const canManage = can(GROUPS.SUPPORT);
  const isPortal = user?.role === 'Customer';
  const isSettled = ['Resolved', 'Closed'].includes(ticket.status);
  const sla = slaState(ticket);

  const send = async () => {
    if (!reply.trim()) return;
    try {
      await run((a) => a.post(`/tickets/${id}/replies`, { message: reply.trim(), isInternal: internal }));
      setReply('');
      setInternal(false);
      refresh();
    } catch { /* message shown under the composer */ }
  };

  const tabs = [
    { key: 'conversation', label: `Conversation (${replies.length})` },
    { key: 'files', label: 'Files' },
    // Tracking is the internal edit history — not something to show the customer.
    ...(canManage ? [{ key: 'tracking', label: 'Tracking' }] : []),
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/support" className="hover:underline">Support</Link>}
        title={ticket.subject}
        subtitle={
          // Badges and provenance on one wrapping line, so a long subject keeps
          // the heading to itself instead of running into the ticket number.
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="chip bg-slate-100 font-medium text-slate-600">{ticket.ticketNumber}</span>
            <Badge>{ticket.status}</Badge>
            <Badge>{ticket.priority}</Badge>
            {ticket.isEscalated && <span className="chip bg-rose-100 text-rose-700">Escalated</span>}
            {ticket.isSlaBreached && !ticket.resolvedAt && <span className="chip bg-rose-100 text-rose-700">SLA breached</span>}
            <span className="text-slate-400">
              {ticket.category} · via {ticket.channel} · raised {fromNow(ticket.createdAt)}
            </span>
          </span>
        }
        actions={
          <>
            {canManage && !isSettled && <button className="btn-ghost btn-sm" onClick={() => setEscalating(true)}>Escalate</button>}
            {canManage && !isSettled && <button className="btn-primary btn-sm" onClick={() => setResolving(true)}>Resolve</button>}
            {isPortal && isSettled && !ticket.satisfactionRating && (
              <button className="btn-primary btn-sm" onClick={() => setRating(true)}>Rate this ticket</button>
            )}
          </>
        }
      />

      {/* items-start stops the short sidebar from being stretched to the height
          of the conversation, which left its cards floating mid-column. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card-pad">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Description</h3>
            <p className={`whitespace-pre-wrap text-sm ${ticket.description ? 'text-slate-700' : 'italic text-slate-400'}`}>
              {ticket.description || 'No description was provided.'}
            </p>
          </div>

          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          {tab === 'conversation' && (
            <div className="card">
              <ul className="divide-y divide-slate-100">
                {replies.length === 0 && (
                  <li className="px-5 py-10">
                    <EmptyState title="No replies yet" hint={isPortal ? 'Our team will respond here.' : 'Reply below to start the conversation.'} />
                  </li>
                )}
                {replies.map((r) => {
                  const author = r.authorName || nameOf(r.author);
                  const isMine = String(r.author?._id || r.author) === String(user?._id);
                  return (
                    <li key={r._id} className={`flex gap-3 px-5 py-4 ${r.isInternal ? 'bg-amber-50/60' : ''}`}>
                      <Avatar name={author} url={r.author?.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium text-slate-800">{author}</span>
                          {isMine && <span className="text-xs text-slate-400">(you)</span>}
                          {r.author?.role && r.author.role !== 'Customer' && (
                            <span className="chip bg-slate-100 text-slate-600">{r.author.role === 'CustomerSupport' ? 'Support' : r.author.role}</span>
                          )}
                          {r.isInternal && <span className="chip bg-amber-100 text-amber-800">Internal note</span>}
                          {/* Relative time reads better; the exact stamp is on hover. */}
                          <span className="ml-auto text-xs text-slate-400" title={dateTime(r.createdAt)}>{fromNow(r.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{r.message}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {ticket.status !== 'Closed' ? (
                <div className="border-t border-slate-100 p-4">
                  {replyError && <p className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{replyError}</p>}
                  <textarea
                    className="input" rows={3} value={reply}
                    placeholder={internal ? 'Write an internal note…' : 'Write a reply…'}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }}
                  />
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                    {canManage ? (
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                        Internal note <span className="text-slate-400">(hidden from the customer)</span>
                      </label>
                    ) : <span className="text-xs text-slate-400">Ctrl + Enter to send</span>}
                    <button className="btn-primary btn-sm" onClick={send} disabled={pending || !reply.trim()}>
                      {pending ? <Spinner className="h-4 w-4" /> : internal ? 'Add note' : 'Send reply'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
                  This ticket is closed, so the conversation is read-only.
                </p>
              )}
            </div>
          )}

          {tab === 'files' && <AttachmentsPanel entityType="SupportTicket" entityId={id} />}
          {tab === 'tracking' && <TrackingPanel entityType="SupportTicket" entityId={id} />}
        </div>

        <div className="space-y-4">
          <div className="card-pad">
            <h3 className="mb-1 text-sm font-semibold text-slate-900">Ticket details</h3>
            <dl className="divide-y divide-slate-100">
              <Row label="Customer" value={ticket.customer
                ? <Link className="font-medium text-brand-700 hover:underline" to={`/customers/${ticket.customer._id}`}>{ticket.customer.name}</Link>
                : null} />
              <Row label="Contact" value={ticket.contact ? nameOf(ticket.contact) : null} />
              {!isPortal && <Row label="Raised by" value={ticket.reportedBy ? nameOf(ticket.reportedBy) : null} />}
              <Row label="Assigned to" value={ticket.assignedTo
                ? nameOf(ticket.assignedTo)
                : <span className="text-slate-400">Unassigned</span>} />
              <Row label="Raised" value={dateTime(ticket.createdAt)} />
              {ticket.isEscalated && <Row label="Escalated to" value={ticket.escalatedTo ? nameOf(ticket.escalatedTo) : 'An administrator'} />}
              {ticket.satisfactionRating && (
                <Row label="Rating" value={
                  <span className="text-amber-500" title={`${ticket.satisfactionRating} out of 5`}>
                    {'★'.repeat(ticket.satisfactionRating)}<span className="text-slate-300">{'★'.repeat(5 - ticket.satisfactionRating)}</span>
                  </span>
                } />
              )}
            </dl>
          </div>

          <div className="card-pad">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Service level</h3>
              {sla && <span className={`chip ${sla.chip}`}>{sla.text}</span>}
            </div>
            <dl className="divide-y divide-slate-100">
              <Row label="SLA due" value={dateTime(ticket.slaDueAt)} tone={sla?.tone} />
              <Row label="First response" value={ticket.firstResponseAt
                ? <span title={dateTime(ticket.firstResponseAt)}>{fromNow(ticket.firstResponseAt)}</span>
                : <span className="text-amber-600">Awaiting</span>} />
              <Row label="Resolution time" value={ticket.resolutionHours != null ? `${ticket.resolutionHours} hours` : null} />
            </dl>
          </div>

          {ticket.resolution && (
            <div className="card-pad">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Resolution</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{ticket.resolution}</p>
            </div>
          )}

          {ticket.escalationReason && canManage && (
            <div className="card-pad">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Escalation reason</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{ticket.escalationReason}</p>
            </div>
          )}

          {ticket.satisfactionComment && (
            <div className="card-pad">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Customer feedback</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{ticket.satisfactionComment}</p>
            </div>
          )}
        </div>
      </div>

      <EscalateModal open={escalating} onClose={() => setEscalating(false)} id={id} users={users} onDone={() => { refresh(); setToast('Ticket escalated'); }} />
      <ResolveModal open={resolving} onClose={() => setResolving(false)} id={id} onDone={() => { refresh(); setToast('Ticket resolved'); }} />
      <RatingModal open={rating} onClose={() => setRating(false)} id={id} onDone={() => { refresh(); setToast('Thanks for the feedback'); }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function EscalateModal({ open, onClose, id, users, onDone }) {
  const [form, setForm] = useState({ escalatedTo: '', reason: '' });
  const { run, pending, error } = useMutation();
  return (
    <Modal open={open} onClose={onClose} title="Escalate ticket" width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          await run((a) => a.post(`/tickets/${id}/escalate`, form)); onDone(); onClose();
        }}>Escalate</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <Field label="Escalate to" hint="Leave blank to route to an administrator.">
          <UserSelect users={users} value={form.escalatedTo} onChange={(e) => setForm({ ...form, escalatedTo: e.target.value })} placeholder="An administrator" />
        </Field>
        <Field label="Reason"><textarea className="input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ResolveModal({ open, onClose, id, onDone }) {
  const [form, setForm] = useState({ resolution: '', close: false });
  const { run, pending, error } = useMutation();
  return (
    <Modal open={open} onClose={onClose} title="Resolve ticket" width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          await run((a) => a.post(`/tickets/${id}/resolve`, form)); onDone(); onClose();
        }}>Resolve</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <Field label="Resolution" hint="The customer is emailed a copy of this summary."><textarea className="input" rows={4} value={form.resolution} onChange={(e) => setForm({ ...form, resolution: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.close} onChange={(e) => setForm({ ...form, close: e.target.checked })} />
          Close the ticket as well
        </label>
      </div>
    </Modal>
  );
}

function RatingModal({ open, onClose, id, onDone }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const { run, pending, error } = useMutation();
  return (
    <Modal open={open} onClose={onClose} title="How did we do?" width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          try {
            await run((a) => a.post(`/tickets/${id}/rate`, { rating, comment }));
            onDone(); onClose();
          } catch { /* message shown in the modal */ }
        }}>Submit</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <div>
          <span className="label">Rating</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}
                className={`h-10 w-10 rounded-lg border text-lg ${n <= rating ? 'border-amber-300 bg-amber-50 text-amber-500' : 'border-slate-200 text-slate-300'}`}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                ★
              </button>
            ))}
          </div>
        </div>
        <Field label="Comment (optional)"><textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
