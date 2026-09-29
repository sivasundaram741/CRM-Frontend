import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const currencyFormatters = new Map();

export function money(value, currency = 'INR', { compact = false } = {}) {
  const key = `${currency}-${compact}`;
  if (!currencyFormatters.has(key)) {
    currencyFormatters.set(key, new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? 'compact' : 'standard',
    }));
  }
  return currencyFormatters.get(key).format(Number(value) || 0);
}

export const number = (value, compact = false) =>
  new Intl.NumberFormat('en-IN', { notation: compact ? 'compact' : 'standard', maximumFractionDigits: 1 })
    .format(Number(value) || 0);

export const percent = (value) => (value == null ? '—' : `${Number(value).toFixed(1)}%`);

export const date = (value, fmt = 'DD MMM YYYY') => (value ? dayjs(value).format(fmt) : '—');
export const dateTime = (value) => (value ? dayjs(value).format('DD MMM YYYY, HH:mm') : '—');
export const fromNow = (value) => (value ? dayjs(value).fromNow() : '—');
export const isPast = (value) => !!value && dayjs(value).isBefore(dayjs());

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';

export const nameOf = (record) => {
  if (!record) return '—';
  if (typeof record === 'string') return record;
  return record.fullName || record.name || `${record.firstName || ''} ${record.lastName || ''}`.trim() || '—';
};

/** Tailwind classes per status label, shared by every badge in the app. */
const TONE = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
  pink: 'bg-pink-100 text-pink-700',
  green: 'bg-emerald-100 text-emerald-700',
  red: 'bg-rose-100 text-rose-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

const STATUS_TONE = {
  // leads
  New: 'slate', Contacted: 'blue', Qualified: 'violet', 'Proposal Sent': 'amber',
  Negotiation: 'pink', Won: 'green', Lost: 'red',
  // opportunities
  Proposal: 'amber', 'Closed Won': 'green', 'Closed Lost': 'red',
  // documents
  Draft: 'slate', 'Pending Approval': 'amber', Approved: 'green', Sent: 'blue',
  Accepted: 'green', Rejected: 'red', Expired: 'slate', Converted: 'indigo',
  Issued: 'blue', 'Partially Paid': 'amber', Paid: 'green', Overdue: 'red',
  Cancelled: 'slate', 'Credit Noted': 'violet', Processing: 'blue', Delivered: 'green',
  Pending: 'slate', Packed: 'blue', Shipped: 'indigo', Returned: 'red',
  Unpaid: 'red',
  // tasks & activities
  Todo: 'slate', 'In Progress': 'blue', Review: 'violet', Done: 'green',
  Planned: 'slate', Completed: 'green',
  // tickets
  Open: 'blue', 'Waiting on Customer': 'amber', Escalated: 'red', Resolved: 'green', Closed: 'slate',
  // priority
  Low: 'slate', Medium: 'blue', High: 'amber', Critical: 'red',
  // ratings / campaigns
  Hot: 'red', Warm: 'amber', Cold: 'blue',
  Running: 'green', Paused: 'amber',
  Active: 'green', Inactive: 'slate', Churned: 'red', Prospect: 'violet',
};

export const statusClass = (status) => TONE[STATUS_TONE[status] || 'slate'];
