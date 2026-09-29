import { useState } from 'react';
import dayjs from 'dayjs';
import { useFetch } from '../hooks/useApi.js';
import ExportMenu from '../components/ExportMenu.jsx';
import { PageHeader, Loading, ErrorState, Badge, EmptyState, DateRangePicker, Tabs } from '../components/ui.jsx';
import { ChartCard, RankedBars, TrendArea, GroupedBars, Funnel } from '../components/charts.jsx';
import { SimpleTable } from './Accounts.jsx';
import { money, number, percent, date } from '../lib/format.js';

const REPORTS = [
  { key: 'leads', label: 'Leads', hint: 'Funnel, sources and owner conversion' },
  { key: 'sales', label: 'Sales', hint: 'Revenue collected, by month, mode and customer' },
  { key: 'revenue', label: 'Revenue', hint: 'Invoiced vs collected vs outstanding' },
  { key: 'opportunities', label: 'Opportunities', hint: 'Win rate, cycle length and loss reasons' },
  { key: 'employees', label: 'Employees', hint: 'Per-person scorecard against target' },
  { key: 'customers', label: 'Customers', hint: 'Growth, mix and top accounts' },
  { key: 'quotations', label: 'Quotations', hint: 'Volume and conversion by status' },
  { key: 'activities', label: 'Activities', hint: 'Coverage by type and by person' },
  { key: 'campaigns', label: 'Campaigns', hint: 'Reach, response and ROI' },
  { key: 'support', label: 'Support', hint: 'Resolution, SLA and satisfaction' },
];

/**
 * Each report returns its own shape, so a block one report has and another
 * lacks must not take the screen down. These keep a missing section rendering
 * as empty rather than throwing.
 */
const obj = (v) => (v && typeof v === 'object' ? v : {});
const list = (v) => (Array.isArray(v) ? v : []);

export default function Reports() {
  const [type, setType] = useState('leads');
  const [range, setRange] = useState({
    from: dayjs().subtract(90, 'day').format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD'),
  });
  const { data, loading, error, refresh } = useFetch(`/reports/${type}`, range);

  const active = REPORTS.find((r) => r.key === type);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={active?.hint}
        actions={<DateRangePicker from={range.from} to={range.to} onChange={setRange} className="w-72" />}
      />

      {/* The shared tab bar, spread across the full width: this is the page's
          primary navigation, so the ten reports get even columns rather than
          bunching to the left with dead space after them. */}
      <Tabs fill active={type} onChange={setType} tabs={REPORTS.map((r) => ({ key: r.key, label: r.label }))} />

      {loading && <Loading label={`Building the ${active?.label.toLowerCase()} report…`} />}
      {error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && data && (
        <>
          {data.period && (
            <p className="mb-4 text-sm text-slate-500">
              Period: <span className="font-medium text-slate-700">{date(data.period.from)} — {date(data.period.to)}</span>
            </p>
          )}
          {type === 'leads' && <LeadReport data={data} />}
          {type === 'sales' && <SalesReport data={data} />}
          {type === 'revenue' && <RevenueReport data={data} />}
          {type === 'opportunities' && <OpportunityReport data={data} />}
          {type === 'employees' && <EmployeeReport data={data} />}
          {type === 'customers' && <CustomerReport data={data} />}
          {type === 'quotations' && <QuotationReport data={data} />}
          {type === 'activities' && <ActivityReport data={data} />}
          {type === 'campaigns' && <CampaignReport data={data} />}
          {type === 'support' && <SupportReport data={data} />}
        </>
      )}
    </>
  );
}

function Kpis({ items }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map(([label, value, sub]) => (
        <div key={label} className="card-pad">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 text-xl font-semibold text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

function ExportButton({ rows, name }) {
  if (!rows?.length) return null;
  // Report tables are derived, not a collection, so the rows travel to the
  // server and come back rendered in whichever format was picked.
  return <ExportMenu rows={rows} title={name.replace(/-/g, ' ')} filename={name} />;
}

function LeadReport({ data }) {
  return (
    <>
      <Kpis items={[
        ['Total leads', number(obj(data.summary).total)],
        ['Converted', number(obj(data.summary).converted), percent(obj(data.summary).conversionRate)],
        ['Lost', number(obj(data.summary).lost)],
        ['Pipeline value', money(obj(data.summary).pipelineValue, 'INR', { compact: true })],
      ]} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Leads by status" height="auto"><Funnel data={list(data.byStatus)} labelKey="status" valueKey="count" secondaryKey="value" /></ChartCard>
        <ChartCard title="Leads by source" height={260}>
          {list(data.bySource).length ? <RankedBars data={list(data.bySource)} categoryKey="source" valueKey="count" /> : <EmptyState title="No sources" />}
        </ChartCard>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Conversion by owner</h3>
          <ExportButton rows={list(data.byOwner)} name="lead-conversion-by-owner" />
        </div>
        <SimpleTable rows={list(data.byOwner).map((r, i) => ({ ...r, _id: i }))} empty="No owners"
          columns={[['Owner', (r) => r.name], ['Leads', (r) => number(r.count)], ['Converted', (r) => number(r.converted)],
            ['Lost', (r) => number(r.lost)], ['Conversion rate', (r) => percent(r.conversionRate)]]} />
      </div>
    </>
  );
}

function SalesReport({ data }) {
  return (
    <>
      <Kpis items={[
        ['Revenue collected', money(obj(data.summary).totalRevenue)],
        ['Transactions', number(obj(data.summary).transactions)],
        ['Average payment', money(obj(data.summary).averageTicket)],
        ['Outstanding', money(obj(data.summary).outstanding)],
      ]} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue by month" height={260}>
          <TrendArea data={list(data.revenueByMonth)} xKey="period" yKey="revenue" label="Revenue" currency="INR" />
        </ChartCard>
        <ChartCard title="Payments by mode" height={260}>
          <RankedBars data={list(data.byPaymentMode)} categoryKey="mode" valueKey="total" currency="INR" />
        </ChartCard>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Top customers</h3>
          <ExportButton rows={list(data.topCustomers)} name="top-customers" />
        </div>
        <SimpleTable rows={list(data.topCustomers).map((r, i) => ({ ...r, _id: i }))} empty="No payments in this period"
          columns={[['Customer', (r) => r.name], ['Number', (r) => r.customerNumber || '—'],
            ['Payments', (r) => number(r.payments)], ['Total', (r) => money(r.total)]]} />
      </div>
    </>
  );
}

function RevenueReport({ data }) {
  return (
    <>
      <Kpis items={[
        ['Invoiced', money(data.invoiced), `${data.invoiceCount} invoices`],
        ['Collected', money(data.collected), percent(data.collectionRate) + ' collection rate'],
        ['Refunded', money(data.refunded)],
        ['Outstanding', money(data.outstanding), `${data.outstandingInvoices} invoices`],
      ]} />
      <ChartCard title="Invoiced vs collected" subtitle="Net revenue after refunds" height={260}>
        <GroupedBars
          data={[{ label: 'This period', invoiced: data.invoiced, collected: data.netRevenue }]}
          xKey="label"
          series={[{ key: 'invoiced', label: 'Invoiced' }, { key: 'collected', label: 'Net collected' }]}
          currency="INR"
        />
      </ChartCard>
    </>
  );
}

function OpportunityReport({ data }) {
  return (
    <>
      <Kpis items={[
        ['Total deals', number(obj(data.summary).total), money(obj(data.summary).totalValue, 'INR', { compact: true })],
        ['Won', number(obj(data.summary).won), money(obj(data.summary).wonValue, 'INR', { compact: true })],
        ['Win rate', percent(obj(data.summary).winRate)],
        ['Average cycle', `${obj(data.summary).averageCycleDays} days`, `avg deal ${money(obj(data.summary).averageDealSize, 'INR', { compact: true })}`],
      ]} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Value by stage" height={260}>
          <RankedBars data={list(data.byStage)} categoryKey="stage" valueKey="value" currency="INR" ordinal />
        </ChartCard>
        <ChartCard title="Why deals were lost" height={260}>
          {list(data.lostReasons).length ? <RankedBars data={list(data.lostReasons)} categoryKey="reason" valueKey="count" /> : <EmptyState title="No losses recorded" />}
        </ChartCard>
      </div>
    </>
  );
}

function EmployeeReport({ data }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Performance scorecard</h3>
        <ExportButton rows={list(data.rows)} name="employee-performance" />
      </div>
      <SimpleTable rows={list(data.rows)} empty="No staff activity in this period"
        columns={[
          ['Employee', (r) => <span><span className="font-medium">{r.name}</span><span className="block text-xs text-slate-400">{r.role}</span></span>],
          ['Leads', (r) => `${r.leadsConverted}/${r.leads}`],
          ['Lead conv.', (r) => percent(r.leadConversionRate)],
          ['Deals won', (r) => `${r.dealsWon}/${r.deals}`],
          ['Win rate', (r) => percent(r.winRate)],
          ['Won value', (r) => money(r.wonValue)],
          ['Activities', (r) => `${r.activitiesCompleted}/${r.activities}`],
          ['Tasks', (r) => `${r.tasksDone}/${r.tasks}`],
          ['Target', (r) => (r.target ? money(r.target) : '—')],
          ['Attainment', (r) => (r.attainment == null ? '—' : (
            <span className={`font-medium ${r.attainment >= 100 ? 'text-emerald-600' : r.attainment >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{percent(r.attainment)}</span>
          ))],
        ]} />
      {list(data.rows).length > 0 && (
        <div className="mt-4">
          <ChartCard title="Won value by employee" height={280}>
            <RankedBars data={list(data.rows).filter((r) => r.wonValue > 0).slice(0, 10)} categoryKey="name" valueKey="wonValue" currency="INR" />
          </ChartCard>
        </div>
      )}
    </>
  );
}

function CustomerReport({ data }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Customers by status" height={240}>
          <RankedBars data={list(data.byStatus)} categoryKey="status" valueKey="count" />
        </ChartCard>
        <ChartCard title="Revenue by industry" height={240}>
          {list(data.byIndustry).length ? <RankedBars data={list(data.byIndustry)} categoryKey="industry" valueKey="revenue" currency="INR" /> : <EmptyState title="No industries set" />}
        </ChartCard>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="New customers per month" height={240}>
          <TrendArea data={list(data.growth)} xKey="period" yKey="count" label="New customers" />
        </ChartCard>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Top accounts</h3>
            <ExportButton rows={list(data.topCustomers)} name="top-accounts" />
          </div>
          <SimpleTable rows={list(data.topCustomers)} empty="No customers"
            columns={[['Customer', (r) => r.name], ['Status', (r) => <Badge>{r.status}</Badge>],
              ['Revenue', (r) => money(r.totalRevenue)], ['Outstanding', (r) => money(r.outstandingAmount)]]} />
        </div>
      </div>
    </>
  );
}

function QuotationReport({ data }) {
  return (
    <>
      <Kpis items={[
        ['Quotations', number(obj(data.summary).total)],
        ['Converted', number(obj(data.summary).converted)],
        ['Conversion rate', percent(obj(data.summary).conversionRate)],
        ['Total value', money(obj(data.summary).totalValue, 'INR', { compact: true })],
      ]} />
      <ChartCard title="Quotations by status" height={260}>
        <RankedBars data={list(data.byStatus)} categoryKey="status" valueKey="count" />
      </ChartCard>
    </>
  );
}

function ActivityReport({ data }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Activities by type" height={280}>
          <RankedBars data={list(data.byType)} categoryKey="type" valueKey="count" />
        </ChartCard>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Coverage by person</h3>
            <ExportButton rows={list(data.byUser)} name="activity-by-user" />
          </div>
          <SimpleTable rows={list(data.byUser).map((r, i) => ({ ...r, _id: i }))} empty="No activities"
            columns={[['Person', (r) => r.name], ['Logged', (r) => number(r.count)],
              ['Completed', (r) => number(r.completed)], ['Completion', (r) => percent(r.completionRate)]]} />
        </div>
      </div>
    </>
  );
}

function CampaignReport({ data }) {
  return (
    <>
      <Kpis items={[
        ['Campaigns', number(obj(data.summary).campaigns)],
        ['Messages sent', number(obj(data.summary).totalSent)],
        ['Total cost', money(obj(data.summary).totalCost)],
        ['Attributed revenue', money(obj(data.summary).totalRevenue)],
      ]} />
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Campaign performance</h3>
        <ExportButton rows={list(data.rows)} name="campaign-performance" />
      </div>
      <SimpleTable rows={list(data.rows).map((r) => ({ ...r, _id: r.id }))} empty="No campaigns in this period"
        columns={[
          ['Campaign', (r) => r.name], ['Channel', (r) => r.type], ['Status', (r) => <Badge>{r.status}</Badge>],
          ['Sent', (r) => number(r.sent)], ['Open rate', (r) => percent(r.openRate)], ['Click rate', (r) => percent(r.clickRate)],
          ['Cost', (r) => money(r.cost)], ['Revenue', (r) => money(r.revenue)],
          ['ROI', (r) => (r.roi == null ? '—' : <span className={r.roi >= 0 ? 'font-medium text-emerald-600' : 'font-medium text-rose-600'}>{percent(r.roi)}</span>)],
        ]} />
    </>
  );
}

function SupportReport({ data }) {
  return (
    <>
      <Kpis items={[
        ['Tickets', number(obj(data.summary).total), `${obj(data.summary).open} still open`],
        ['Resolution rate', percent(obj(data.summary).resolutionRate)],
        ['Avg resolution', `${obj(data.summary).averageResolutionHours} h`, `${obj(data.summary).slaBreaches} SLA breaches`],
        ['Satisfaction', obj(data.summary).csat != null ? `${obj(data.summary).csat} / 5` : '—', percent(obj(data.summary).slaCompliance) + ' SLA compliance'],
      ]} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Tickets by status" height={240}>
          <RankedBars data={list(data.byStatus)} categoryKey="status" valueKey="count" />
        </ChartCard>
        <ChartCard title="Tickets by priority" height={240}>
          <RankedBars data={list(data.byPriority)} categoryKey="priority" valueKey="count" ordinal />
        </ChartCard>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Agent performance</h3>
          <ExportButton rows={list(data.byAgent)} name="support-agents" />
        </div>
        <SimpleTable rows={list(data.byAgent).map((r, i) => ({ ...r, _id: i }))} empty="No agents"
          columns={[['Agent', (r) => r.name], ['Tickets', (r) => number(r.total)], ['Resolved', (r) => number(r.resolved)],
            ['Resolution rate', (r) => percent(r.resolutionRate)], ['Avg rating', (r) => (r.avgRating ? `${r.avgRating} / 5` : '—')]]} />
      </div>
    </>
  );
}
