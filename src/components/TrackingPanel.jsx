import { useFetch } from '../hooks/useApi.js';
import { Loading, EmptyState, Avatar, Badge } from './ui.jsx';
import { dateTime, fromNow, nameOf } from '../lib/format.js';

const FIELD_TONE = {
  status: 'bg-brand-500',
  stage: 'bg-violet-500',
  assignedTo: 'bg-amber-500',
  owner: 'bg-amber-500',
  accountManager: 'bg-amber-500',
  priority: 'bg-rose-500',
  deliveryStatus: 'bg-sky-500',
  paymentStatus: 'bg-emerald-500',
};

/** Formats a dwell time the way people read it. */
function dwell(hours) {
  if (hours == null) return null;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

/**
 * The audited trail of status, stage, ownership and priority changes for one
 * record — who moved it, when, and how long it sat in the previous state.
 */
export default function TrackingPanel({ entityType, entityId }) {
  const { data, loading, error, refresh } = useFetch('/tracking/record', { entityType, entityId });

  if (loading) return <Loading label="Loading tracking history…" />;
  if (error) return <div className="card-pad"><EmptyState title="Could not load tracking" hint={error} /></div>;
  if (!data?.length) {
    return (
      <div className="card-pad">
        <EmptyState
          title="No tracked changes yet"
          hint="Status, stage, ownership and priority changes are recorded here as the record moves."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {data.length} tracked change{data.length === 1 ? '' : 's'}, newest first
        </p>
        <button className="btn-ghost btn-sm" onClick={refresh}>Refresh</button>
      </div>

      <ol className="relative ml-3 border-l border-slate-200">
        {data.map((entry) => (
          <li key={entry._id} className="mb-4 ml-6">
            <span className={`absolute -left-[5px] mt-3 h-2.5 w-2.5 rounded-full ring-4 ring-slate-100 ${FIELD_TONE[entry.field] || 'bg-slate-400'}`} />
            <div className="card-pad">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-slate-100 text-slate-600">{entry.fieldLabel || entry.field}</span>
                <span className="text-sm text-slate-500 line-through decoration-slate-300">{entry.from}</span>
                <span className="text-slate-400" aria-hidden="true">→</span>
                <Badge>{entry.to}</Badge>
                {entry.durationHours != null && (
                  <span className="text-xs text-slate-400" title="Time spent in the previous state">
                    after {dwell(entry.durationHours)}
                  </span>
                )}
              </div>

              {entry.note && <p className="mt-2 text-sm text-slate-600">{entry.note}</p>}

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Avatar name={entry.changedByName || nameOf(entry.changedBy)} url={entry.changedBy?.avatarUrl} size="h-5 w-5" />
                <span>{entry.changedByName || nameOf(entry.changedBy) || 'System'}</span>
                <span aria-hidden="true">·</span>
                <span title={dateTime(entry.createdAt)}>{fromNow(entry.createdAt)}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
