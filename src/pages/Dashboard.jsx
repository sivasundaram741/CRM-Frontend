import { Link } from 'react-router-dom';
import { useFetch } from '../hooks/useApi.js';
import { PageHeader, Loading, ErrorState, Badge, Avatar, EmptyState } from '../components/ui.jsx';
import { ChartCard, TrendArea, GroupedBars, RankedBars, Funnel, StatTile } from '../components/charts.jsx';
import { money, number, percent, date, dateTime, fromNow, nameOf } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

const icons = {
  leads: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5',
  deals: 'M4 6h16M6 12h12M9 18h6',
  revenue: 'M12 3v18m5-14H9.5a2.5 2.5 0 000 5h5a2.5 2.5 0 010 5H7',
  tasks: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  calls: 'M3 5a2 2 0 012-2h2.6a1 1 0 011 .8l1 4a1 1 0 01-.3 1L8 10.5a12 12 0 005.5 5.5l1.7-1.3a1 1 0 011-.2l4 1a1 1 0 01.8 1V19a2 2 0 01-2 2A16 16 0 013 5z',
  support: 'M18.4 18.4A9 9 0 105.6 5.6a9 9 0 0012.8 12.8z',
};

const Icon = ({ d }) => (
  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export default function Dashboard() {
  const { user } = useAuth();
  const summary = useFetch('/dashboard/summary');
  const charts = useFetch('/dashboard/charts', { months: 6 });
  const widgets = useFetch('/dashboard/widgets');

  if (summary.loading) return <Loading label="Building your dashboard…" />;
  if (summary.error) return <ErrorState message={summary.error} onRetry={summary.refresh} />;

  const k = summary.data.kpis;
  const c = charts.data;
  const w = widgets.data;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.firstName}`}
        subtitle={`Here's where things stand as of ${date(new Date(), 'DD MMM YYYY')}.`}
        actions={
          <>
            <Link to="/leads?new=1" className="btn-primary btn-sm">New lead</Link>
            <Link to="/reports" className="btn-ghost btn-sm">Reports</Link>
          </>
        }
      />

      {/* KPI row — headline numbers, no plot needed. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total leads" value={number(k.totalLeads)} sub={`${k.newLeads} new · ${k.qualifiedLeads} qualified`} icon={<Icon d={icons.leads} />} />
        <StatTile label="Conversion rate" value={percent(k.conversionRate)} sub={`${k.convertedLeads} converted`} icon={<Icon d={icons.deals} />} tone="bg-violet-50 text-violet-600" />
        <StatTile label="Monthly revenue" value={money(k.monthlyRevenue, 'INR', { compact: true })} delta={k.revenueGrowth} sub="vs last month" icon={<Icon d={icons.revenue} />} tone="bg-emerald-50 text-emerald-600" />
        <StatTile label="Open pipeline" value={money(k.pipelineValue, 'INR', { compact: true })} sub={`${k.activeOpportunities} deals · ${money(k.weightedPipeline, 'INR', { compact: true })} weighted`} icon={<Icon d={icons.deals} />} tone="bg-amber-50 text-amber-600" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Today's follow-ups" value={number(k.todayFollowUps)} sub="calls & meetings due" icon={<Icon d={icons.calls} />} tone="bg-sky-50 text-sky-600" />
        <StatTile label="Pending tasks" value={number(k.pendingTasks)} sub={k.overdueTasks ? `${k.overdueTasks} overdue` : 'nothing overdue'} icon={<Icon d={icons.tasks} />} tone="bg-slate-100 text-slate-600" />
        <StatTile label="Win rate" value={percent(k.winRate)} sub={`${k.wonDeals} won · ${k.lostDeals} lost this month`} icon={<Icon d={icons.deals} />} tone="bg-emerald-50 text-emerald-600" />
        <StatTile
          label="Customer satisfaction"
          value={k.customerSatisfaction != null ? `${k.customerSatisfaction} / 5` : '—'}
          sub={`${k.openTickets} open tickets · ${k.csatResponses} ratings`}
          icon={<Icon d={icons.support} />}
          tone="bg-rose-50 text-rose-600"
        />
      </div>

      {/* Charts */}
      {charts.loading && <div className="mt-6"><Loading label="Loading charts…" /></div>}
      {c && (
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ChartCard title="Revenue trend" subtitle="Payments collected, last 6 months" height={280}>
              <TrendArea data={c.revenueTrend} xKey="label" yKey="revenue" label="Revenue" currency="INR" />
            </ChartCard>
          </div>

          <ChartCard title="Sales funnel" subtitle="Leads by stage" height="auto">
            <Funnel data={c.salesFunnel} labelKey="stage" valueKey="count" secondaryKey="value" currency="INR" />
          </ChartCard>

          <ChartCard title="Leads created" subtitle="New vs converted per month" height={250}>
            <GroupedBars data={c.monthlyLeads} xKey="label" series={[{ key: 'leads', label: 'Leads' }, { key: 'converted', label: 'Converted' }]} />
          </ChartCard>

          <ChartCard title="Lead sources" subtitle="Where leads come from" height={250}>
            {c.leadSource.length ? <RankedBars data={c.leadSource} categoryKey="source" valueKey="count" /> : <EmptyState title="No lead sources yet" />}
          </ChartCard>

          <ChartCard title="Deal pipeline" subtitle="Open value by stage" height={250}>
            <RankedBars data={c.dealPipeline} categoryKey="stage" valueKey="value" currency="INR" ordinal />
          </ChartCard>

          <div className="xl:col-span-2">
            <ChartCard title="Sales by employee" subtitle="Won deal value, last 6 months" height={260}>
              {c.salesByEmployee.length ? <RankedBars data={c.salesByEmployee} categoryKey="name" valueKey="revenue" currency="INR" /> : <EmptyState title="No closed-won deals yet" />}
            </ChartCard>
          </div>

          <ChartCard title="Customer growth" subtitle="New customers per month" height={260}>
            <TrendArea data={c.customerGrowth} xKey="label" yKey="customers" label="New customers" />
          </ChartCard>
        </div>
      )}

      {/* Working lists */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">Upcoming meetings</h3>
            <Link to="/calendar" className="text-xs font-medium text-brand-600 hover:underline">Calendar</Link>
          </header>
          <ul className="divide-y divide-slate-100">
            {summary.data.upcomingMeetings.length === 0 && <li className="px-5 py-8"><EmptyState title="No meetings scheduled" /></li>}
            {summary.data.upcomingMeetings.map((m) => (
              <li key={m._id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700">
                  {date(m.startAt, 'DD')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{m.subject}</p>
                  <p className="text-xs text-slate-500">{dateTime(m.startAt)}{m.location ? ` · ${m.location}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">My open tasks</h3>
            <Link to="/tasks" className="text-xs font-medium text-brand-600 hover:underline">All tasks</Link>
          </header>
          <ul className="divide-y divide-slate-100">
            {summary.data.myTasks.length === 0 && <li className="px-5 py-8"><EmptyState title="Nothing on your plate" /></li>}
            {summary.data.myTasks.map((t) => (
              <li key={t._id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                  <p className="text-xs text-slate-500">
                    {t.dueDate ? `Due ${date(t.dueDate)}` : 'No due date'}
                    {t.isOverdue && <span className="ml-1.5 font-medium text-rose-600">overdue</span>}
                  </p>
                </div>
                <Badge>{t.priority}</Badge>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
            <Link to="/activities" className="text-xs font-medium text-brand-600 hover:underline">All activity</Link>
          </header>
          <ul className="divide-y divide-slate-100">
            {summary.data.recentActivities.length === 0 && <li className="px-5 py-8"><EmptyState title="No activity logged yet" /></li>}
            {summary.data.recentActivities.map((a) => (
              <li key={a._id} className="flex items-start gap-3 px-5 py-3">
                <Avatar name={nameOf(a.assignedTo)} url={a.assignedTo?.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800"><span className="font-medium">{a.type}</span> — {a.subject}</p>
                  <p className="text-xs text-slate-500">{nameOf(a.assignedTo)} · {fromNow(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {w && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="card">
            <header className="border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-900">Top customers by revenue</h3>
            </header>
            <table className="min-w-full">
              <tbody>
                {w.topCustomers.map((cu) => (
                  <tr key={cu._id} className="border-t border-slate-50">
                    <td className="td">
                      <Link to={`/customers/${cu._id}`} className="font-medium text-brand-700 hover:underline">{cu.name}</Link>
                      <span className="ml-2 text-xs text-slate-400">{cu.customerNumber}</span>
                    </td>
                    <td className="td text-right tabular-nums">{money(cu.totalRevenue)}</td>
                    <td className="td text-right text-xs text-slate-500">{cu.outstandingAmount > 0 ? `${money(cu.outstandingAmount)} due` : 'settled'}</td>
                  </tr>
                ))}
                {w.topCustomers.length === 0 && <tr><td className="td"><EmptyState title="No customers yet" /></td></tr>}
              </tbody>
            </table>
          </section>

          <section className="card">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-900">Overdue tasks</h3>
              <Link to="/tasks" className="text-xs font-medium text-brand-600 hover:underline">Manage</Link>
            </header>
            <table className="min-w-full">
              <tbody>
                {w.overdueTasks.map((t) => (
                  <tr key={t._id} className="border-t border-slate-50">
                    <td className="td max-w-xs truncate">{t.title}</td>
                    <td className="td text-xs text-slate-500">{nameOf(t.assignedTo)}</td>
                    <td className="td text-right text-xs font-medium text-rose-600">{date(t.dueDate)}</td>
                  </tr>
                ))}
                {w.overdueTasks.length === 0 && <tr><td className="td"><EmptyState title="Nothing overdue" hint="The team is on top of things." /></td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </>
  );
}
