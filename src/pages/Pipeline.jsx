import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch, useUsers, useMasterNames, useMutation } from '../hooks/useApi.js';
import RecordForm from '../components/RecordForm.jsx';
import {
  PageHeader, Loading, ErrorState, Badge, Avatar, Modal, Field, Select, UserSelect,
  EmptyState, Toast, errorToast, Drawer, DetailGrid, SearchInput,
} from '../components/ui.jsx';
import { ChartCard, TrendLines } from '../components/charts.jsx';
import { NotesPanel } from './Leads.jsx';
import TrackingPanel from '../components/TrackingPanel.jsx';
import AttachmentsPanel from '../components/AttachmentsPanel.jsx';
import { money, date, nameOf, fromNow } from '../lib/format.js';
import { useAuth, GROUPS } from '../lib/auth.jsx';

// Fallback only - live stages come from the master list in Settings.
const STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const dealFields = ({ customers, stages, types, priorities }) => [
  { name: 'name', label: 'Opportunity name', required: true, span: 2 },
  { name: 'customer', label: 'Customer', type: 'select', options: customers.map((c) => ({ value: c._id, label: c.name })) },
  { name: 'stage', label: 'Stage', type: 'select', options: stages },
  { name: 'amount', label: 'Deal value', type: 'money', min: 0 },
  { name: 'expectedCloseDate', label: 'Expected close date', type: 'date' },
  { name: 'type', label: 'Type', type: 'select', options: types },
  { name: 'priority', label: 'Priority', type: 'select', options: priorities },
  { name: 'assignedTo', label: 'Owner', type: 'user', showWorkload: true, defaultToMe: true },
  { name: 'nextStep', label: 'Next step' },
  { name: 'description', label: 'Description', type: 'textarea', span: 2 },
];

export default function Pipeline() {
  const { can } = useAuth();
  const users = useUsers();
  const stages = useMasterNames('opportunity-stage', STAGES);
  const types = useMasterNames('opportunity-type', ['New Business', 'Existing Business', 'Renewal', 'Upsell']);
  const priorities = useMasterNames('priority', ['Low', 'Medium', 'High', 'Critical']);
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('');
  const board = useFetch('/opportunities/board', { search, assignedTo: owner });
  const forecast = useFetch('/opportunities/forecast', { months: 6 });
  const customersFetch = useFetch('/customers', { limit: 200, sort: 'name' });

  const [form, setForm] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [lostFor, setLostFor] = useState(null);
  const [toast, setToast] = useState('');

  const canWrite = can(GROUPS.SALES);
  const customers = customersFetch.data || [];

  const move = async (dealId, stage, lostReason) => {
    try {
      await api.patch(`/opportunities/${dealId}/stage`, { stage, lostReason });
      setToast(`Deal moved to ${stage}`);
      board.refresh();
    } catch (err) {
      setToast(errorToast(err));
    }
  };

  const onDrop = (stage) => {
    if (!dragging || dragging.stage === stage) return setDragging(null);
    if (stage === 'Closed Lost') { setLostFor({ ...dragging, stage }); setDragging(null); return; }
    move(dragging._id, stage);
    setDragging(null);
  };

  if (board.loading) return <Loading label="Loading pipeline…" />;
  if (board.error) return <ErrorState message={board.error} onRetry={board.refresh} />;

  const { columns, totals } = board.data;

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        subtitle="Drag a deal between columns to move it through the pipeline."
        actions={canWrite && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New opportunity</button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Open deals', totals.openDeals, `${totals.deals} total`],
          ['Open value', money(totals.openValue, 'INR', { compact: true }), 'excludes closed deals'],
          ['Weighted forecast', money(totals.weightedForecast, 'INR', { compact: true }), 'value × stage probability'],
          ['Won value', money(totals.wonValue, 'INR', { compact: true }), 'closed won, all time'],
        ].map(([label, value, sub]) => (
          <div key={label} className="card-pad">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1.5 text-xl font-semibold text-slate-900">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search deals…" />
        <UserSelect users={users} value={owner} onChange={(e) => setOwner(e.target.value)}
          placeholder="All owners" className="w-56" />
      </div>

      {/* Kanban */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
        <div className="flex min-w-max gap-3">
          {columns.map((col) => (
            <div
              key={col.stage}
              className={`w-72 shrink-0 rounded-xl bg-slate-50 p-2.5 transition ${dragging && dragging.stage !== col.stage ? 'ring-2 ring-brand-300' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col.stage)}
            >
              <header className="mb-2.5 flex items-center justify-between px-1.5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">{col.stage}</h3>
                  <p className="text-xs text-slate-500">{col.count} · {money(col.value, 'INR', { compact: true })}</p>
                </div>
                <span className="chip bg-white text-slate-500">{col.probability}%</span>
              </header>

              <div className="space-y-2">
                {col.items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">Drop deals here</p>
                )}
                {col.items.map((deal) => (
                  <article
                    key={deal._id}
                    draggable={canWrite}
                    onDragStart={() => setDragging(deal)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setDetailId(deal._id)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-slate-800">{deal.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{nameOf(deal.customer)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{money(deal.amount, deal.currency, { compact: true })}</span>
                      <Badge>{deal.priority}</Badge>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar name={nameOf(deal.assignedTo)} url={deal.assignedTo?.avatarUrl} size="h-5 w-5" />
                        <span className="text-[11px] text-slate-500">{nameOf(deal.assignedTo)}</span>
                      </span>
                      {deal.expectedCloseDate && <span className="text-[11px] text-slate-400">{date(deal.expectedCloseDate, 'DD MMM')}</span>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {forecast.data?.length > 0 && (
        <div className="mt-5">
          <ChartCard title="Forecast" subtitle="Expected close value by month — total pipeline vs probability-weighted" height={260}>
            <TrendLines
              data={forecast.data}
              xKey="period"
              series={[{ key: 'total', label: 'Total pipeline' }, { key: 'weighted', label: 'Weighted' }]}
              currency="INR"
            />
          </ChartCard>
        </div>
      )}

      <RecordForm
        open={!!form} onClose={() => setForm(null)} onSaved={() => { board.refresh(); setToast('Opportunity created'); }}
        title="New opportunity" endpoint="/opportunities" record={form}
        fields={dealFields({ customers, stages, types, priorities })} defaults={{ stage: stages[0], type: types[0], priority: 'Medium' }}
      />

      <DealDrawer id={detailId} onClose={() => setDetailId(null)} onChanged={board.refresh}
        customers={customers} stages={stages} types={types} priorities={priorities} />

      <LostReasonModal
        deal={lostFor} onClose={() => setLostFor(null)}
        onConfirm={(reason) => { move(lostFor._id, 'Closed Lost', reason); setLostFor(null); }}
      />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function LostReasonModal({ deal, onClose, onConfirm }) {
  const reasons = useMasterNames('lost-reason', ['Price', 'Feature gap', 'Chose competitor', 'Other']);
  const [reason, setReason] = useState('');
  useEffect(() => { setReason(''); }, [deal]);
  if (!deal) return null;

  return (
    <Modal open onClose={onClose} title="Mark deal as lost" width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={() => onConfirm(reason)}>Mark as lost</button></>}>
      <p className="mb-4 text-sm text-slate-600">Recording why <span className="font-medium">{deal.name}</span> was lost keeps the loss-reason report meaningful.</p>
      <Field label="Reason">
        <Select options={reasons} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

function DealDrawer({ id, onClose, onChanged, customers, stages, types, priorities }) {
  const { data, loading, refresh } = useFetch(id ? `/opportunities/${id}/detail` : null);
  const [edit, setEdit] = useState(false);
  if (!id) return null;

  const deal = data?.deal;

  return (
    <>
      <Drawer open onClose={onClose} title={deal?.name || 'Opportunity'}
        footer={<>
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={() => setEdit(true)}>Edit deal</button>
        </>}>
        {loading && <Loading />}
        {deal && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{deal.stage}</Badge>
              <Badge>{deal.priority}</Badge>
              <span className="text-lg font-semibold text-slate-900">{money(deal.amount, deal.currency)}</span>
              <span className="text-sm text-slate-500">· {deal.probability}% probability</span>
            </div>

            <DetailGrid
              columns="sm:grid-cols-2"
              items={[
                { label: 'Number', value: deal.opportunityNumber },
                { label: 'Customer', value: deal.customer ? <Link className="text-brand-700 hover:underline" to={`/customers/${deal.customer._id}`}>{deal.customer.name}</Link> : '—' },
                { label: 'Contact', value: nameOf(deal.contact) },
                { label: 'Owner', value: nameOf(deal.assignedTo) },
                { label: 'Type', value: deal.type },
                { label: 'Source', value: deal.source },
                { label: 'Expected close', value: date(deal.expectedCloseDate) },
                { label: 'Weighted value', value: money(deal.weightedAmount || (deal.amount * deal.probability) / 100) },
                { label: 'Next step', value: deal.nextStep },
                deal.lostReason && { label: 'Lost reason', value: deal.lostReason },
              ]}
            />

            {deal.description && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{deal.description}</p>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Quotations</h4>
              {data.quotations.length === 0
                ? <EmptyState title="No quotations linked" />
                : (
                  <ul className="space-y-2">
                    {data.quotations.map((q) => (
                      <li key={q._id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                        <Link className="text-sm font-medium text-brand-700 hover:underline" to={`/quotations/${q._id}`}>{q.quotationNumber}</Link>
                        <span className="flex items-center gap-2"><Badge>{q.status}</Badge><span className="text-sm tabular-nums">{money(q.grandTotal)}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Notes</h4>
              <NotesPanel entityType="Opportunity" entityId={id} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Files</h4>
              <AttachmentsPanel entityType="Opportunity" entityId={id} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Tracking</h4>
              <TrackingPanel entityType="Opportunity" entityId={id} />
            </div>

            {deal.stageHistory?.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-900">Stage history</h4>
                <ul className="space-y-1.5 text-sm text-slate-600">
                  {deal.stageHistory.map((h, i) => (
                    <li key={i}>{h.from} → <span className="font-medium text-slate-800">{h.to}</span> <span className="text-xs text-slate-400">{fromNow(h.changedAt)}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <RecordForm
        open={edit} onClose={() => setEdit(false)} onSaved={() => { refresh(); onChanged(); }}
        title="Edit opportunity" endpoint="/opportunities" record={deal} fields={dealFields({ customers, stages, types, priorities })}
      />
    </>
  );
}
