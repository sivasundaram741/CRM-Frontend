import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useList, useFetch } from '../hooks/useApi.js';
import DataTable from '../components/DataTable.jsx';
import { PageHeader, Badge, Avatar, Loading, Tabs, EmptyState } from '../components/ui.jsx';
import { ChartCard, RankedBars } from '../components/charts.jsx';
import { SimpleTable } from './Accounts.jsx';
import { dateTime, fromNow, nameOf, number } from '../lib/format.js';

const ENTITIES = ['Lead', 'Opportunity', 'Customer', 'Quotation', 'SalesOrder', 'Invoice', 'SupportTicket', 'Contact', 'Company'];
const FIELDS = [
  { value: 'status', label: 'Status' },
  { value: 'stage', label: 'Stage' },
  { value: 'assignedTo', label: 'Owner' },
  { value: 'accountManager', label: 'Account manager' },
  { value: 'priority', label: 'Priority' },
  { value: 'deliveryStatus', label: 'Delivery' },
  { value: 'paymentStatus', label: 'Payment' },
];

/** Where a record lives once it has moved — used to link back from the trail. */
const ROUTE = {
  Lead: (id) => `/leads/${id}`,
  Customer: (id) => `/customers/${id}`,
  Contact: (id) => `/contacts/${id}`,
  Company: (id) => `/companies/${id}`,
  Quotation: (id) => `/quotations/${id}`,
  Invoice: (id) => `/invoices/${id}`,
  SupportTicket: (id) => `/support/${id}`,
  Opportunity: () => '/pipeline',
  SalesOrder: () => '/orders',
};

const dwell = (hours) => {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
};

export default function Tracking() {
  const [tab, setTab] = useState('log');
  const list = useList('/tracking', { limit: 50 });
  const summary = useFetch('/tracking/summary');

  return (
    <>
      <PageHeader
        title="Tracking"
        subtitle="Every status, stage, ownership and priority change across the system — who moved what, and how long it sat."
      />

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'log', label: 'Change log' },
        { key: 'analysis', label: 'Time in state' },
      ]} />

      {tab === 'log' && (
        <DataTable
          list={list}
          title="tracked changes"
          exportName="tracking-log"
          emptyTitle="Nothing tracked yet"
          emptyHint="Move a lead, deal or ticket and the transition is recorded here."
          filters={[
            { key: 'entityType', label: 'All records', options: ENTITIES },
            { key: 'field', label: 'All fields', options: FIELDS },
            { key: 'changedBy', label: 'All users', type: 'user' },
          ]}
          columns={[
            { key: 'createdAt', label: 'When', sortable: true, render: (r) => (
              <span title={dateTime(r.createdAt)}>{fromNow(r.createdAt)}</span>
            ), exportValue: (r) => dateTime(r.createdAt) },
            { key: 'entityType', label: 'Record', render: (r) => (
              <span>
                <span className="chip bg-slate-100 text-slate-600">{r.entityType}</span>
                {ROUTE[r.entityType]
                  ? <Link className="ml-2 font-medium text-brand-700 hover:underline" to={ROUTE[r.entityType](r.entityId)}>{r.entityLabel || '—'}</Link>
                  : <span className="ml-2">{r.entityLabel || '—'}</span>}
              </span>
            ), exportValue: (r) => `${r.entityType}: ${r.entityLabel || ''}` },
            { key: 'fieldLabel', label: 'Field', render: (r) => r.fieldLabel || r.field },
            { key: 'from', label: 'From', render: (r) => <span className="text-slate-500">{r.from}</span> },
            { key: 'to', label: 'To', render: (r) => <Badge>{r.to}</Badge> },
            { key: 'durationHours', label: 'After', className: 'text-right', render: (r) => (
              <span className="tabular-nums text-slate-500">{dwell(r.durationHours)}</span>
            ) },
            { key: 'changedByName', label: 'By', render: (r) => (
              <span className="inline-flex items-center gap-2">
                <Avatar name={r.changedByName || nameOf(r.changedBy)} url={r.changedBy?.avatarUrl} size="h-6 w-6" />
                <span className="text-xs">{r.changedByName || nameOf(r.changedBy) || 'System'}</span>
              </span>
            ), exportValue: (r) => r.changedByName || '' },
            { key: 'note', label: 'Note', render: (r) => (
              <span className="block max-w-xs truncate text-slate-500" title={r.note}>{r.note || '—'}</span>
            ) },
          ]}
        />
      )}

      {tab === 'analysis' && (
        summary.loading ? <Loading /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Changes by record type" subtitle="Where the movement is" height={260}>
                {summary.data?.byEntity?.length
                  ? <RankedBars data={summary.data.byEntity} categoryKey="entityType" valueKey="changes" />
                  : <EmptyState title="No changes recorded yet" />}
              </ChartCard>
              <ChartCard title="Changes by person" subtitle="Who is moving records" height={260}>
                {summary.data?.byUser?.length
                  ? <RankedBars data={summary.data.byUser} categoryKey="name" valueKey="changes" />
                  : <EmptyState title="No changes recorded yet" />}
              </ChartCard>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Average time spent in each state</h3>
              <p className="mb-3 text-sm text-slate-500">
                Measured from when a record entered a state to when it left. Long dwell times are where work stalls.
              </p>
              <SimpleTable
                rows={(summary.data?.averageTimeInState || []).map((r, i) => ({ ...r, _id: i }))}
                empty="Not enough history yet — states need at least one transition each."
                columns={[
                  ['Record', (r) => <span className="chip bg-slate-100 text-slate-600">{r.entityType}</span>],
                  ['State', (r) => <Badge>{r.state}</Badge>],
                  ['Times left', (r) => number(r.changes)],
                  ['Average dwell', (r) => (
                    <span className="tabular-nums font-medium text-slate-800">
                      {r.avgDays >= 1 ? `${r.avgDays} days` : `${r.avgHours} h`}
                    </span>
                  )],
                ]}
              />
            </div>
          </div>
        )
      )}
    </>
  );
}
