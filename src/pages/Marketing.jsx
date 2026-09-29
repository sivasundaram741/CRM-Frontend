import { useState } from 'react';
import { useList, useFetch, useUsers, useMasterNames, useMutation } from '../hooks/useApi.js';
import DataTable from '../components/DataTable.jsx';
import RecordForm from '../components/RecordForm.jsx';
import { SimpleTable } from './Accounts.jsx';
import {
  PageHeader, Badge, Loading, Modal, Field, Select, DatePicker, Tabs, Toast, EmptyState, DetailGrid, Spinner,
} from '../components/ui.jsx';
import { ChartCard, RankedBars } from '../components/charts.jsx';
import { money, date, dateTime, percent, nameOf } from '../lib/format.js';
import { useAuth, GROUPS } from '../lib/auth.jsx';

// Fallbacks only - live options come from the master lists in Settings.
const CAMPAIGN_TYPES = ['Email', 'SMS', 'WhatsApp', 'Social', 'Event', 'Webinar'];
const CAMPAIGN_STATUS = ['Planned', 'Running', 'Paused', 'Completed', 'Cancelled'];

// ---------------------------------------------------------------- Campaigns

export function Campaigns() {
  const list = useList('/campaigns');
  const channels = useMasterNames('campaign-type', CAMPAIGN_TYPES);
  const statuses = useMasterNames('campaign-status', CAMPAIGN_STATUS);
  const templates = useFetch('/email-templates', { limit: 100 });
  const { can } = useAuth();
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [launching, setLaunching] = useState(null);
  const [toast, setToast] = useState('');
  const canWrite = can(GROUPS.MARKETING);

  const fields = [
    { name: 'name', label: 'Campaign name', required: true, span: 2 },
    { name: 'type', label: 'Channel', type: 'select', options: channels },
    { name: 'status', label: 'Status', type: 'select', options: statuses },
    { name: 'owner', label: 'Campaign owner', type: 'user', defaultToMe: true },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'endDate', label: 'End date', type: 'date' },
    { name: 'budget', label: 'Budget', type: 'money', min: 0 },
    { name: 'actualCost', label: 'Actual cost', type: 'money', min: 0 },
    { name: 'expectedRevenue', label: 'Expected revenue', type: 'money', min: 0 },
    { name: 'targetCount', label: 'Target audience size', type: 'number', min: 0 },
    { name: 'targetAudience', label: 'Audience description', span: 2 },
    { name: 'template', label: 'Email template', type: 'select', options: (templates.data || []).map((t) => ({ value: t._id, label: t.name })) },
    { name: 'description', label: 'Description', type: 'textarea', span: 2 },
  ];

  return (
    <>
      <PageHeader title="Campaigns" subtitle="Outbound programmes, their responses and return."
        actions={canWrite && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New campaign</button>} />
      <DataTable
        list={list} title="campaigns" exportName="campaigns" onRowClick={setDetail}
        emptyTitle="No campaigns yet"
        filters={[
          { key: 'type', label: 'All channels', options: channels },
          { key: 'status', label: 'All statuses', options: statuses },
          { key: 'owner', label: 'All owners', type: 'user' },
        ]}
        columns={[
          { key: 'name', label: 'Campaign', sortable: true, render: (r) => (
            <span><span className="font-medium">{r.name}</span><span className="block text-xs text-slate-400">{r.campaignNumber}</span></span>
          ) },
          { key: 'type', label: 'Channel', sortable: true },
          { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
          { key: 'sentCount', label: 'Sent', className: 'text-right' },
          { key: 'actualCost', label: 'Cost', className: 'text-right', render: (r) => money(r.actualCost) },
          { key: 'actualRevenue', label: 'Revenue', className: 'text-right', render: (r) => money(r.actualRevenue) },
          { key: 'roi', label: 'ROI', className: 'text-right', render: (r) => (
            r.roi == null ? '—' : <span className={r.roi >= 0 ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'}>{percent(r.roi)}</span>
          ) },
          { key: 'actions', label: '', render: (r) => canWrite && r.status !== 'Completed'
            ? <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setLaunching(r); }}>Launch</button> : null },
        ]}
      />

      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); setToast('Campaign saved'); }}
        title={form?._id ? 'Edit campaign' : 'New campaign'} endpoint="/campaigns" record={form} fields={fields}
        defaults={{ type: channels[0], status: statuses[0] }} />

      <CampaignDetail campaign={detail} onClose={() => setDetail(null)} onEdit={(c) => { setDetail(null); setForm(c); }} />
      <LaunchModal campaign={launching} onClose={() => setLaunching(null)} onDone={(msg) => { setToast(msg); list.refresh(); }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function CampaignDetail({ campaign, onClose, onEdit }) {
  const { data, loading } = useFetch(campaign ? `/campaigns/${campaign._id}/performance` : null);
  const responses = useFetch(campaign ? '/campaign-responses' : null, { campaign: campaign?._id, limit: 50 });
  if (!campaign) return null;

  return (
    <Modal open onClose={onClose} title={campaign.name} width="max-w-4xl"
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={() => onEdit(campaign)}>Edit campaign</button></>}>
      {loading && <Loading />}
      {data && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Sent', data.metrics.sent],
              ['Open rate', percent(data.metrics.openRate)],
              ['Click rate', percent(data.metrics.clickRate)],
              ['Conversion', percent(data.metrics.conversionRate)],
              ['Cost', money(data.metrics.cost)],
              ['Revenue', money(data.metrics.revenue)],
              ['ROI', data.metrics.roi == null ? '—' : percent(data.metrics.roi)],
              ['Cost per conversion', data.metrics.costPerConversion == null ? '—' : money(data.metrics.costPerConversion)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <ChartCard title="Response funnel" subtitle="How recipients engaged" height={220}>
            <RankedBars data={data.funnel.filter((f) => f.count > 0)} categoryKey="type" valueKey="count" ordinal />
          </ChartCard>

          <DetailGrid columns="sm:grid-cols-3" items={[
            { label: 'Channel', value: campaign.type },
            { label: 'Status', value: <Badge>{campaign.status}</Badge> },
            { label: 'Owner', value: nameOf(campaign.owner) },
            { label: 'Start', value: date(campaign.startDate) },
            { label: 'End', value: date(campaign.endDate) },
            { label: 'Audience', value: campaign.targetAudience },
          ]} />

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Recent responses</h4>
            <SimpleTable rows={responses.data || []} empty="No responses recorded"
              columns={[['Recipient', (r) => r.recipient || nameOf(r.lead)], ['Response', (r) => <Badge tone="bg-slate-100 text-slate-700">{r.responseType}</Badge>],
                ['Revenue', (r) => (r.revenueGenerated ? money(r.revenueGenerated) : '—')], ['When', (r) => date(r.respondedAt)]]} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function LaunchModal({ campaign, onClose, onDone }) {
  const leadStatuses = useMasterNames('lead-status', ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation']);
  const [form, setForm] = useState({ audience: 'leads', subject: '', body: '', limit: 100, status: '' });
  const { run, pending, error } = useMutation();
  if (!campaign) return null;

  const submit = async () => {
    const filter = form.status ? { status: form.status } : {};
    const res = await run((a) => a.post(`/campaigns/${campaign._id}/launch`, {
      audience: form.audience, filter, subject: form.subject || undefined, body: form.body || undefined, limit: form.limit,
    }));
    onDone(`Campaign sent to ${res.data.sent} recipient(s)`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Launch — ${campaign.name}`}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={pending}>{pending ? <Spinner className="h-4 w-4" /> : 'Send now'}</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <p className="mb-4 text-sm text-slate-600">
        Recipients are drawn from the selected audience. Placeholders such as <code className="rounded bg-slate-100 px-1 text-xs">{'{{firstName}}'}</code> and{' '}
        <code className="rounded bg-slate-100 px-1 text-xs">{'{{company}}'}</code> are substituted per recipient.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Audience">
          <Select options={[{ value: 'leads', label: 'Leads' }, { value: 'contacts', label: 'Contacts' }, { value: 'customers', label: 'Customers' }]}
            value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} placeholder={null} />
        </Field>
        <Field label="Max recipients"><input className="input" type="number" min="1" max="2000" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.valueAsNumber || 100 })} /></Field>
        {form.audience === 'leads' && (
          <Field label="Only leads with status" className="sm:col-span-2">
            <Select options={leadStatuses} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} placeholder="Any status" />
          </Field>
        )}
        <Field label="Subject override" className="sm:col-span-2"><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Leave blank to use the campaign template" /></Field>
        <Field label="Body override" className="sm:col-span-2"><textarea className="input" rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="<p>Hi {{firstName}}, …</p>" /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Email

export function EmailModule() {
  const [folder, setFolder] = useState('Sent');
  const list = useList('/emails', { folder });
  const templates = useList('/email-templates');
  const [tab, setTab] = useState('mail');
  const [compose, setCompose] = useState(false);
  const [templateForm, setTemplateForm] = useState(null);
  const [reading, setReading] = useState(null);
  const [toast, setToast] = useState('');

  return (
    <>
      <PageHeader title="Email" subtitle="Send, schedule and template your outbound mail."
        actions={<button className="btn-primary btn-sm" onClick={() => setCompose(true)}>Compose</button>} />

      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'mail', label: 'Mailbox' }, { key: 'templates', label: 'Templates' }]} />

      {tab === 'mail' && (
        <>
          <div className="mb-3 flex gap-1">
            {['Inbox', 'Sent', 'Scheduled', 'Drafts'].map((f) => (
              <button key={f} onClick={() => { setFolder(f); list.setFilter({ folder: f }); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${folder === f ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {f}
              </button>
            ))}
          </div>
          <DataTable
            list={list} title="emails" onRowClick={setReading}
            emptyTitle={`Nothing in ${folder}`}
            columns={[
              { key: 'subject', label: 'Subject', sortable: true, render: (r) => <span className="font-medium text-slate-800">{r.subject}</span> },
              { key: 'to', label: 'To', render: (r) => (r.to || []).join(', ') },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              { key: 'openCount', label: 'Opens', className: 'text-right' },
              { key: 'sentAt', label: 'Sent', sortable: true, render: (r) => dateTime(r.sentAt || r.scheduledAt || r.createdAt) },
            ]}
          />
        </>
      )}

      {tab === 'templates' && (
        <DataTable
          list={templates} title="templates" onRowClick={setTemplateForm}
          emptyTitle="No templates yet"
          actions={<button className="btn-primary btn-sm" onClick={() => setTemplateForm({})}>New template</button>}
          columns={[
            { key: 'name', label: 'Template', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
            { key: 'subject', label: 'Subject' },
            { key: 'category', label: 'Category', sortable: true },
            { key: 'updatedAt', label: 'Updated', sortable: true, render: (r) => date(r.updatedAt) },
          ]}
        />
      )}

      <ComposeModal open={compose} onClose={() => setCompose(false)} templates={templates.rows} onDone={() => { list.refresh(); setToast('Email queued'); }} />

      <RecordForm
        open={!!templateForm} onClose={() => setTemplateForm(null)} onSaved={() => { templates.refresh(); setToast('Template saved'); }}
        title={templateForm?._id ? 'Edit template' : 'New template'} endpoint="/email-templates" record={templateForm}
        fields={[
          { name: 'name', label: 'Template name', required: true },
          { name: 'category', label: 'Category', type: 'select', options: ['General', 'Sales', 'Marketing', 'Finance', 'Support'] },
          { name: 'subject', label: 'Subject', required: true, span: 2 },
          { name: 'body', label: 'Body (HTML)', type: 'textarea', rows: 8, span: 2, required: true, hint: 'Use {{firstName}}, {{company}} and similar placeholders.' },
        ]}
        defaults={{ category: 'General' }}
      />

      {reading && (
        <Modal open onClose={() => setReading(null)} title={reading.subject} width="max-w-2xl">
          <DetailGrid columns="sm:grid-cols-2" items={[
            { label: 'To', value: (reading.to || []).join(', ') },
            { label: 'Status', value: <Badge>{reading.status}</Badge> },
            { label: 'Sent', value: dateTime(reading.sentAt || reading.scheduledAt) },
            { label: 'Opens / clicks', value: `${reading.openCount || 0} / ${reading.clickCount || 0}` },
          ]} />
          <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700"
            dangerouslySetInnerHTML={{ __html: reading.body || '<p class="text-slate-400">No body</p>' }} />
        </Modal>
      )}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function ComposeModal({ open, onClose, templates, onDone }) {
  const [form, setForm] = useState({ to: '', subject: '', body: '', templateId: '', scheduledAt: '' });
  const { run, pending, error } = useMutation();

  const applyTemplate = (id) => {
    const tpl = templates.find((t) => t._id === id);
    setForm((f) => ({ ...f, templateId: id, subject: tpl?.subject || f.subject, body: tpl?.body || f.body }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Compose email" width="max-w-2xl"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          await run((a) => a.post('/emails/send', {
            to: form.to.split(',').map((t) => t.trim()).filter(Boolean),
            subject: form.subject, body: form.body,
            templateId: form.templateId || undefined,
            scheduledAt: form.scheduledAt || undefined,
          }));
          onDone(); onClose();
        }}>{pending ? <Spinner className="h-4 w-4" /> : form.scheduledAt ? 'Schedule' : 'Send'}</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <Field label="To" required hint="Comma-separate multiple recipients."><input className="input" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="someone@example.com" /></Field>
        <Field label="Use a template">
          <Select options={templates.map((t) => ({ value: t._id, label: t.name }))} value={form.templateId} onChange={(e) => applyTemplate(e.target.value)} placeholder="Start from scratch" />
        </Field>
        <Field label="Subject" required><input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
        <Field label="Body (HTML)"><textarea className="input font-mono text-xs" rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
        <Field label="Schedule for later" hint="Leave blank to send immediately."><DatePicker withTime placeholder="Send immediately" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
