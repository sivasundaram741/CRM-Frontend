import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch, useMutation, useUsers, useMasterNames, userOptions } from '../hooks/useApi.js';
import {
  Loading, ErrorState, Toast, errorToast, Field, Select, UserSelect, Spinner, Badge, EmptyState,
} from '../components/ui.jsx';
import { dateTime, fromNow } from '../lib/format.js';

/**
 * Settings → Integrations.
 *
 * The credentials for Meta, WhatsApp, Instagram and the website form used to
 * live only in the server's .env, which meant connecting a channel or rotating
 * an expired token needed shell access to the box. Everything here is stored as
 * settings instead, so the person who owns the Meta app can do it themselves.
 *
 * Secrets are never sent back to the browser — a saved one reads as dots, and
 * submitting the dots leaves the stored value alone.
 */

const MASK = '••••••••';

function CopyField({ label, value, hint }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700" title={value}>{value}</code>
        <button
          type="button" className="btn-ghost btn-sm shrink-0"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }).catch(() => {});
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function IntegrationCard({ row, users, onSaved }) {
  const [values, setValues] = useState({});
  const [enabled, setEnabled] = useState(row.enabled);
  const [open, setOpen] = useState(false);
  const [test, setTest] = useState(null);
  const { run, pending, error } = useMutation();
  const { run: runTest, pending: testing } = useMutation();

  // Reset whenever the server sends a fresh copy, so a save elsewhere does not
  // leave this card showing what was typed before it.
  useEffect(() => {
    setValues(Object.fromEntries(row.fields.map((f) => [f.key, f.value ?? ''])));
    setEnabled(row.enabled);
  }, [row]);

  const sources = useMasterNames('lead-source', []);
  const brands = useMasterNames('brand', []);
  const dirty = useMemo(
    () => row.enabled !== enabled || row.fields.some((f) => (values[f.key] ?? '') !== (f.value ?? '')),
    [row, values, enabled]
  );

  const save = async () => {
    try {
      await run((a) => a.put(`/settings/integrations/${row.key}`, { enabled, values }));
      setTest(null);
      onSaved(`${row.label} saved`);
    } catch (err) {
      onSaved(errorToast(err));
    }
  };

  const check = async () => {
    try {
      const res = await runTest((a) => a.post(`/settings/integrations/${row.key}/test`));
      setTest(res.data);
    } catch (err) {
      setTest({ ok: false, message: err.message });
    }
  };

  const state = row.ready ? { label: 'Connected', tone: 'bg-emerald-100 text-emerald-700' }
    : row.enabled ? { label: 'Needs details', tone: 'bg-amber-100 text-amber-700' }
      : { label: 'Off', tone: 'bg-slate-100 text-slate-600' };

  return (
    <div className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{row.label}</h3>
            <span className={`chip ${state.tone}`}>{state.label}</span>
            {row.webhookField && <span className="chip bg-slate-100 text-slate-600">field: {row.webhookField}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-500">{row.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
              checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
            />
            Enabled
          </label>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Configure'}
          </button>
        </div>
      </header>

      {open && (
        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-slate-600">{row.description}</p>

          {row.dependsOn && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Uses the credentials on the <span className="font-medium">Meta app</span> card above.
            </p>
          )}

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {row.fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                hint={field.help}
                className={field.type === 'textarea' ? 'sm:col-span-2' : ''}
              >
                {field.type === 'user' ? (
                  <UserSelect
                    users={users} value={values[field.key] || ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    placeholder="Auto-assign (round-robin)"
                  />
                ) : field.master ? (
                  <Select
                    options={field.master === 'brand' ? brands : sources}
                    value={values[field.key] || ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    placeholder={field.master === 'brand' ? 'Default brand' : 'Pick a lead source'}
                  />
                ) : field.type === 'textarea' ? (
                  <textarea
                    className="input" rows={3} placeholder={field.placeholder}
                    value={values[field.key] || ''}
                    onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  />
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="input" type={field.secret ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={values[field.key] || ''}
                      // A stored secret arrives as dots; clear them on focus so
                      // it is obvious you are replacing, not appending.
                      onFocus={(e) => { if (e.target.value === MASK) setValues({ ...values, [field.key]: '' }); }}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    />
                    {field.generate && (
                      <button
                        type="button" className="btn-ghost btn-sm shrink-0"
                        onClick={() => {
                          const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
                            .map((b) => b.toString(16).padStart(2, '0')).join('');
                          setValues({ ...values, [field.key]: token });
                        }}
                      >
                        Generate
                      </button>
                    )}
                  </div>
                )}
                {field.fromEnv && (values[field.key] ?? '') === (field.value ?? '') && (
                  <p className="mt-1 text-xs text-slate-400">Currently coming from {field.env} in the server environment.</p>
                )}
              </Field>
            ))}
          </div>

          {row.webhookUrl && (
            <CopyField
              label="Webhook URL"
              value={row.webhookUrl}
              hint={
                row.key === 'website-form'
                  ? 'Post your form here with the token in an x-ingest-token header.'
                  : 'Paste this into the Meta app webhook dialog, with the verify token above.'
              }
            />
          )}

          {test && (
            <p className={`rounded-lg px-3 py-2 text-sm ${test.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
              {test.message}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <div className="flex gap-2">
              <button className="btn-primary btn-sm" onClick={save} disabled={pending || !dirty}>
                {pending ? <Spinner className="h-4 w-4" /> : 'Save'}
              </button>
              {/* A save only proves it was typed; this proves it works. */}
              <button className="btn-ghost btn-sm" onClick={check} disabled={testing || dirty}>
                {testing ? <Spinner className="h-4 w-4" /> : 'Test connection'}
              </button>
            </div>
            {row.docsUrl && (
              <a className="text-xs text-brand-700 hover:underline" href={row.docsUrl} target="_blank" rel="noreferrer">
                Provider documentation ↗
              </a>
            )}
          </div>
          {dirty && <p className="text-xs text-slate-500">Save before testing, so the check runs against what is stored.</p>}
        </div>
      )}
    </div>
  );
}

/** Recent webhook deliveries, so a silent channel can be diagnosed. */
function InboundLog() {
  const { data, loading, error, refresh } = useFetch('/settings/integrations/inbound/log', { limit: 25 });
  const [toast, setToast] = useState('');
  const { run, pending } = useMutation();

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const TONE = {
    Processed: 'bg-emerald-100 text-emerald-700',
    Duplicate: 'bg-slate-100 text-slate-600',
    Ignored: 'bg-slate-100 text-slate-600',
    Failed: 'bg-rose-100 text-rose-700',
    Received: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="card">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Recent deliveries</h3>
          <p className="text-xs text-slate-500">Every inbound webhook is stored before it is read, so nothing is lost to a parsing error.</p>
        </div>
        <button className="btn-ghost btn-sm" onClick={refresh}>Refresh</button>
      </header>

      {!data?.length ? (
        <div className="px-5 py-10">
          <EmptyState title="Nothing received yet" hint="Deliveries appear here as soon as a channel sends its first payload." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Channel</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Lead</th>
                <th className="px-4 py-2 font-medium">Note</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row._id} className="text-slate-700">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500" title={dateTime(row.createdAt)}>{fromNow(row.createdAt)}</td>
                  <td className="px-4 py-2">
                    {row.provider || row.channel}
                    {row.signatureVerified && <span className="ml-1 text-xs text-emerald-600" title="Signature verified">✓</span>}
                  </td>
                  <td className="px-4 py-2"><Badge tone={TONE[row.status]}>{row.status}</Badge></td>
                  <td className="px-4 py-2">
                    {row.lead
                      ? <a className="text-brand-700 hover:underline" href={`/leads/${row.lead._id}`}>{`${row.lead.firstName} ${row.lead.lastName || ''}`.trim()}</a>
                      : <span className="text-slate-300">—</span>}
                    {row.merged && <span className="ml-1 text-xs text-slate-400">(merged)</span>}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-slate-500" title={row.error || row.note || ''}>{row.error || row.note || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    {row.status === 'Failed' && row.channel === 'meta' && (
                      <button
                        className="btn-ghost btn-sm" disabled={pending}
                        onClick={async () => {
                          try {
                            await run((a) => a.post(`/settings/integrations/inbound/${row._id}/replay`));
                            setToast('Replayed'); refresh();
                          } catch (err) { setToast(errorToast(err)); }
                        }}
                      >
                        Replay
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  );
}

export default function IntegrationSettings() {
  const { data, loading, error, refresh } = useFetch('/settings/integrations');
  const users = userOptions(useUsers());
  const [toast, setToast] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const groups = (data || []).reduce((acc, row) => {
    (acc[row.group] ??= []).push(row);
    return acc;
  }, {});

  const connected = (data || []).filter((r) => r.ready).length;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{connected} of {(data || []).length} connected.</span>{' '}
        Credentials live here rather than in the server environment, so a channel can be connected or a
        token rotated without a redeploy. Saved secrets are never shown again.
      </div>

      {Object.entries(groups).map(([group, rows]) => (
        <section key={group} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</h2>
          {rows.map((row) => (
            <IntegrationCard
              key={row.key} row={row} users={users}
              onSaved={(msg) => { setToast(msg); refresh(); }}
            />
          ))}
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Activity</h2>
        <InboundLog />
      </section>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  );
}
