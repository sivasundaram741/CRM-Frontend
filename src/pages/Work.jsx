import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../lib/api.js';
import { useList, useFetch, useUsers, useMasterNames } from '../hooks/useApi.js';
import DataTable from '../components/DataTable.jsx';
import RecordForm from '../components/RecordForm.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import {
  PageHeader, Badge, Avatar, Loading, ErrorState, EmptyState, Toast, errorToast, Select, Modal, DetailGrid, Tabs,
} from '../components/ui.jsx';
import { date, dateTime, nameOf, statusClass } from '../lib/format.js';

// Fallbacks only - live options come from the master lists in Settings.
const ACTIVITY_TYPES = ['Phone Call', 'Meeting', 'Email', 'SMS', 'WhatsApp', 'Task', 'Visit', 'Demo', 'Follow-up'];
const ACTIVITY_STATUS = ['Planned', 'In Progress', 'Completed', 'Cancelled'];
const TASK_STATUS = ['Todo', 'In Progress', 'Review', 'Done', 'Cancelled'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const activityFields = ({ types, statuses, priorities }) => [
  { name: 'type', label: 'Type', type: 'select', options: types, required: true },
  { name: 'status', label: 'Status', type: 'select', options: statuses },
  { name: 'subject', label: 'Subject', required: true, span: 2 },
  { name: 'startAt', label: 'Starts', type: 'datetime' },
  { name: 'endAt', label: 'Ends', type: 'datetime' },
  { name: 'priority', label: 'Priority', type: 'select', options: priorities },
  { name: 'assignedTo', label: 'Assigned to', type: 'user', showWorkload: true, defaultToMe: true },
  { name: 'location', label: 'Location' },
  { name: 'meetingLink', label: 'Meeting link' },
  { name: 'reminderAt', label: 'Reminder', type: 'datetime' },
  { name: 'description', label: 'Notes', type: 'textarea', span: 2 },
];

const taskFields = ({ statuses, priorities }) => [
  { name: 'title', label: 'Title', required: true, span: 2 },
  { name: 'status', label: 'Status', type: 'select', options: statuses },
  { name: 'priority', label: 'Priority', type: 'select', options: priorities },
  { name: 'assignedTo', label: 'Assigned to', type: 'user', showWorkload: true, defaultToMe: true },
  { name: 'dueDate', label: 'Due date', type: 'date' },
  { name: 'reminderAt', label: 'Reminder', type: 'datetime' },
  { name: 'progress', label: 'Progress %', type: 'number', min: 0 },
  { name: 'isRecurring', label: 'Repeats', type: 'checkbox' },
  { name: 'description', label: 'Description', type: 'textarea', span: 2 },
];

// ---------------------------------------------------------------- Calendar

export function Calendar() {
  const [view, setView] = useState('month');
  const [anchor, setAnchor] = useState(dayjs());
  const [types, setTypes] = useState('');
  const [selected, setSelected] = useState(null);
  const activityTypes = useMasterNames('activity-type', ACTIVITY_TYPES);
  const activityStatuses = useMasterNames('activity-status', ACTIVITY_STATUS);
  const priorities = useMasterNames('priority', PRIORITIES);
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  const { data, loading, error, refresh } = useFetch('/activities/calendar', {
    view, date: anchor.toISOString(), types,
  });

  const events = data?.events || [];
  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      const key = dayjs(e.start).format('YYYY-MM-DD');
      (map[key] ??= []).push(e);
    }
    return map;
  }, [events]);

  const step = (dir) => setAnchor((a) => a.add(dir, view === 'month' ? 'month' : view === 'week' ? 'week' : 'day'));

  const title = view === 'month' ? anchor.format('MMMM YYYY')
    : view === 'week' ? `Week of ${anchor.startOf('week').format('DD MMM')}`
    : view === 'day' ? anchor.format('dddd, DD MMMM YYYY')
    : 'Next 30 days';

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Meetings, calls, follow-ups and task deadlines in one place."
        actions={
          <>
            {/* The visible range, as a table or as a real .ics that opens in
                Outlook, Google Calendar or Apple Calendar. */}
            <ExportMenu
              rows={events.map((e) => ({
                id: e.id,
                title: e.title,
                type: e.type,
                status: e.status,
                start: e.start,
                end: e.end,
                allDay: e.allDay,
                location: e.location,
                relatedLabel: e.relatedLabel,
                assignedTo: nameOf(e.assignedTo),
              }))}
              columns={['title', 'type', 'status', 'start', 'end', 'location', 'relatedLabel', 'assignedTo']}
              title={`Calendar — ${title}`}
              filename={`calendar-${anchor.format('YYYY-MM')}`}
              formats={['ics', 'xlsx', 'pdf', 'csv', 'html', 'json']}
              onError={(err) => setToast(errorToast(err))}
            />
            <button className="btn-primary btn-sm" onClick={() => setForm({})}>New activity</button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          {['day', 'week', 'month', 'agenda'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${view === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {v}
            </button>
          ))}
        </div>
        {view !== 'agenda' && (
          <div className="flex items-center gap-1">
            <button className="btn-ghost btn-sm" onClick={() => step(-1)} aria-label="Previous">←</button>
            <button className="btn-ghost btn-sm" onClick={() => setAnchor(dayjs())}>Today</button>
            <button className="btn-ghost btn-sm" onClick={() => step(1)} aria-label="Next">→</button>
          </div>
        )}
        <span className="text-sm font-semibold text-slate-800">{title}</span>
        <Select className="ml-auto w-48" options={activityTypes} value={types} onChange={(e) => setTypes(e.target.value)} placeholder="All types" />
      </div>

      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && view === 'month' && <MonthGrid anchor={anchor} byDay={byDay} onSelect={setSelected} />}
      {!loading && !error && view === 'week' && <WeekGrid anchor={anchor} byDay={byDay} onSelect={setSelected} />}
      {!loading && !error && (view === 'day' || view === 'agenda') && <AgendaList events={events} onSelect={setSelected} />}

      <EventModal event={selected} onClose={() => setSelected(null)} onChanged={() => { refresh(); setToast('Activity updated'); }} />
      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { refresh(); setToast('Activity created'); }}
        title="New activity" endpoint="/activities" record={form}
        fields={activityFields({ types: activityTypes, statuses: activityStatuses, priorities })}
        defaults={{ type: 'Meeting', status: 'Planned', priority: 'Medium', startAt: dayjs().format('YYYY-MM-DDTHH:mm') }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

const typeDot = (type) => ({
  Meeting: 'bg-brand-500', 'Phone Call': 'bg-emerald-500', Email: 'bg-sky-500',
  'Follow-up': 'bg-amber-500', Demo: 'bg-violet-500', Visit: 'bg-pink-500', Task: 'bg-slate-400',
}[type] || 'bg-slate-400');

function MonthGrid({ anchor, byDay, onSelect }) {
  const start = anchor.startOf('month').startOf('week');
  const days = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'));
  const today = dayjs().format('YYYY-MM-DD');

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = day.format('YYYY-MM-DD');
          const items = byDay[key] || [];
          const inMonth = day.month() === anchor.month();
          return (
            <div key={key} className={`min-h-28 border-b border-r border-slate-100 p-1.5 ${inMonth ? '' : 'bg-slate-50/60'}`}>
              <div className="mb-1 flex justify-end">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                  key === today ? 'bg-brand-600 font-semibold text-white' : inMonth ? 'text-slate-600' : 'text-slate-300'}`}>
                  {day.date()}
                </span>
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map((e) => (
                  <button key={e.id} onClick={() => onSelect(e)}
                    className="flex w-full items-center gap-1.5 truncate rounded px-1 py-0.5 text-left text-[11px] text-slate-700 hover:bg-slate-100">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${typeDot(e.type)}`} />
                    <span className="truncate">{e.title}</span>
                  </button>
                ))}
                {items.length > 3 && <p className="px-1 text-[11px] text-slate-400">+{items.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ anchor, byDay, onSelect }) {
  const start = anchor.startOf('week');
  const days = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
  const today = dayjs().format('YYYY-MM-DD');

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((day) => {
        const key = day.format('YYYY-MM-DD');
        const items = byDay[key] || [];
        return (
          <div key={key} className="card">
            <header className={`border-b border-slate-100 px-3 py-2 ${key === today ? 'bg-brand-50' : ''}`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{day.format('ddd')}</p>
              <p className="text-sm font-semibold text-slate-800">{day.format('DD MMM')}</p>
            </header>
            <div className="space-y-1.5 p-2">
              {items.length === 0 && <p className="py-3 text-center text-xs text-slate-300">—</p>}
              {items.map((e) => (
                <button key={e.id} onClick={() => onSelect(e)} className="w-full rounded-lg border border-slate-200 p-2 text-left hover:border-brand-300">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${typeDot(e.type)}`} />
                    <span className="truncate text-xs font-medium text-slate-800">{e.title}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{dayjs(e.start).format('HH:mm')} · {e.type}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaList({ events, onSelect }) {
  if (!events.length) return <div className="card-pad"><EmptyState title="Nothing scheduled" hint="Create an activity to see it here." /></div>;
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id}>
          <button onClick={() => onSelect(e)} className="card-pad flex w-full items-center gap-4 text-left hover:border-brand-300">
            <div className="w-24 shrink-0">
              <p className="text-xs font-semibold text-slate-800">{dayjs(e.start).format('DD MMM')}</p>
              <p className="text-xs text-slate-500">{e.allDay ? 'All day' : dayjs(e.start).format('HH:mm')}</p>
            </div>
            <span className={`h-8 w-1 shrink-0 rounded-full ${typeDot(e.type)}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{e.title}</p>
              <p className="truncate text-xs text-slate-500">{e.type}{e.relatedLabel ? ` · ${e.relatedLabel}` : ''}{e.location ? ` · ${e.location}` : ''}</p>
            </div>
            <Badge>{e.status}</Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}

function EventModal({ event, onClose, onChanged }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!event) return null;
  const isTask = event.kind === 'task';

  const complete = async () => {
    setBusy(true);
    setError('');
    try {
      if (isTask) await api.patch(`/tasks/${event.id}`, { status: 'Done' });
      else await api.post(`/activities/${event.id}/complete`, {});
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={event.title} width="max-w-lg"
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Close</button>
        {!['Completed', 'Done', 'Cancelled'].includes(event.status) && (
          <button className="btn-primary" onClick={complete} disabled={busy}>Mark {isTask ? 'done' : 'completed'}</button>
        )}
      </>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <DetailGrid columns="sm:grid-cols-2" items={[
        { label: 'Type', value: event.type },
        { label: 'Status', value: <Badge>{event.status}</Badge> },
        { label: 'Starts', value: dateTime(event.start) },
        { label: 'Ends', value: event.end ? dateTime(event.end) : '—' },
        { label: 'Priority', value: event.priority },
        { label: 'Owner', value: nameOf(event.assignedTo) },
        event.location && { label: 'Location', value: event.location },
        event.meetingLink && { label: 'Meeting link', value: <a className="text-brand-700 hover:underline" href={event.meetingLink} target="_blank" rel="noreferrer">Join</a> },
        event.relatedLabel && { label: 'Related to', value: `${event.relatedTo}: ${event.relatedLabel}` },
      ]} />
    </Modal>
  );
}

// ---------------------------------------------------------------- Activities list

export function Activities() {
  const list = useList('/activities');
  const activityTypes = useMasterNames('activity-type', ACTIVITY_TYPES);
  const activityStatuses = useMasterNames('activity-status', ACTIVITY_STATUS);
  const priorities = useMasterNames('priority', PRIORITIES);
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  return (
    <>
      <PageHeader title="Activities" subtitle="Every call, meeting, demo and follow-up logged against a record."
        actions={<button className="btn-primary btn-sm" onClick={() => setForm({})}>Log activity</button>} />
      <DataTable
        list={list} title="activities" exportName="activities"
        emptyTitle="No activities logged"
        onRowClick={(r) => setForm(r)}
        filters={[
          { key: 'type', label: 'All types', options: activityTypes },
          { key: 'status', label: 'All statuses', options: activityStatuses },
          { key: 'assignedTo', label: 'All owners', type: 'user' },
        ]}
        columns={[
          { key: 'subject', label: 'Subject', sortable: true, render: (r) => <span className="font-medium text-slate-800">{r.subject}</span> },
          { key: 'type', label: 'Type', sortable: true, render: (r) => (
            <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${typeDot(r.type)}`} />{r.type}</span>
          ) },
          { key: 'relatedLabel', label: 'Related to', render: (r) => r.relatedLabel || '—' },
          { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
          { key: 'priority', label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { key: 'assignedTo', label: 'Owner', render: (r) => (
            <span className="inline-flex items-center gap-2"><Avatar name={nameOf(r.assignedTo)} size="h-6 w-6" /><span className="text-xs">{nameOf(r.assignedTo)}</span></span>
          ), exportValue: (r) => nameOf(r.assignedTo) },
          { key: 'startAt', label: 'When', sortable: true, render: (r) => dateTime(r.startAt) },
        ]}
      />
      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); setToast('Saved'); }}
        title={form?._id ? 'Edit activity' : 'Log activity'} endpoint="/activities" record={form}
        fields={activityFields({ types: activityTypes, statuses: activityStatuses, priorities })}
        defaults={{ type: 'Phone Call', status: 'Completed', priority: 'Medium', startAt: dayjs().format('YYYY-MM-DDTHH:mm') }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

// ---------------------------------------------------------------- Tasks

export function Tasks() {
  const [tab, setTab] = useState('board');
  const board = useFetch('/tasks/board');
  const list = useList('/tasks');
  const taskStatuses = useMasterNames('task-status', TASK_STATUS);
  const priorities = useMasterNames('priority', PRIORITIES);
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');
  const [dragging, setDragging] = useState(null);

  const refreshAll = () => { board.refresh(); list.refresh(); };

  const move = async (taskId, status) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status });
      setToast(`Task moved to ${status}`);
      refreshAll();
    } catch (err) {
      // Without this the card silently snaps back with no explanation.
      setToast(errorToast(err));
      refreshAll();
    }
  };

  return (
    <>
      <PageHeader title="Tasks" subtitle="What your team needs to do next."
        actions={<button className="btn-primary btn-sm" onClick={() => setForm({})}>New task</button>} />

      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'board', label: 'Board' }, { key: 'list', label: 'List' }]} />

      {tab === 'board' && (
        board.loading ? <Loading /> : board.error ? <ErrorState message={board.error} onRetry={board.refresh} /> : (
          <>
            {board.data.overdue > 0 && (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                {board.data.overdue} task{board.data.overdue > 1 ? 's are' : ' is'} past due.
              </p>
            )}
            <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
              <div className="flex min-w-max gap-3">
                {board.data.columns.map((col) => (
                  <div key={col.status} className={`w-72 shrink-0 rounded-xl bg-slate-50 p-2.5 ${dragging && dragging.status !== col.status ? 'ring-2 ring-brand-300' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => { if (dragging && dragging.status !== col.status) move(dragging._id, col.status); setDragging(null); }}>
                    <header className="mb-2.5 flex items-center justify-between px-1.5">
                      <h3 className="text-sm font-semibold text-slate-800">{col.status}</h3>
                      <span className="chip bg-white text-slate-500">{col.items.length}</span>
                    </header>
                    <div className="space-y-2">
                      {col.items.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">Drop tasks here</p>}
                      {col.items.map((t) => (
                        <article key={t._id} draggable onDragStart={() => setDragging(t)} onDragEnd={() => setDragging(null)}
                          onClick={() => setForm(t)}
                          className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300">
                          <p className="line-clamp-2 text-sm font-medium text-slate-800">{t.title}</p>
                          {t.relatedLabel && <p className="mt-1 truncate text-xs text-slate-500">{t.relatedLabel}</p>}
                          <div className="mt-2 flex items-center justify-between">
                            <Badge>{t.priority}</Badge>
                            {t.dueDate && (
                              <span className={`text-[11px] ${t.isOverdue ? 'font-medium text-rose-600' : 'text-slate-400'}`}>{date(t.dueDate, 'DD MMM')}</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                            <Avatar name={nameOf(t.assignedTo)} size="h-5 w-5" />
                            <span className="text-[11px] text-slate-500">{nameOf(t.assignedTo)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}

      {tab === 'list' && (
        <DataTable
          list={list} title="tasks" exportName="tasks" onRowClick={(r) => setForm(r)}
          emptyTitle="No tasks"
          filters={[
            { key: 'status', label: 'All statuses', options: taskStatuses },
            { key: 'priority', label: 'All priorities', options: priorities },
            { key: 'assignedTo', label: 'All owners', type: 'user' },
          ]}
          columns={[
            { key: 'title', label: 'Task', sortable: true, render: (r) => (
              <span><span className="font-medium">{r.title}</span><span className="block text-xs text-slate-400">{r.taskNumber}</span></span>
            ) },
            { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
            { key: 'priority', label: 'Priority', sortable: true, render: (r) => <Badge>{r.priority}</Badge> },
            { key: 'relatedLabel', label: 'Related to' },
            { key: 'assignedTo', label: 'Owner', render: (r) => nameOf(r.assignedTo), exportValue: (r) => nameOf(r.assignedTo) },
            { key: 'dueDate', label: 'Due', sortable: true, render: (r) => (
              <span className={r.isOverdue ? 'font-medium text-rose-600' : ''}>{date(r.dueDate)}</span>
            ) },
            { key: 'progress', label: 'Progress', className: 'text-right', render: (r) => `${r.progress || 0}%` },
          ]}
        />
      )}

      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { refreshAll(); setToast('Saved'); }}
        title={form?._id ? 'Edit task' : 'New task'} endpoint="/tasks" record={form}
        fields={taskFields({ statuses: taskStatuses, priorities })}
        defaults={{ status: taskStatuses[0], priority: 'Medium' }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}
