import { useEffect, useState } from 'react';
import { Modal, Field, Select, UserSelect, DatePicker, Spinner } from './ui.jsx';
import { api } from '../lib/api.js';
import { useUsers } from '../hooks/useApi.js';
import { useAuth, isNarrowAccess } from '../lib/auth.jsx';

/**
 * Schema-driven create/edit modal shared by every module.
 *
 * fields: { name, label, type, options, required, placeholder, span, hint, rows }
 *   type: text | textarea | number | date | datetime | select | checkbox | email | tel | money
 */
export default function RecordForm({
  open,
  onClose,
  onSaved,
  title,
  endpoint,
  record,
  fields,
  defaults = {},
  transform,
}) {
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Any `type: 'user'` field is populated from the login-user list.
  const users = useUsers({ workload: fields.some((f) => f.type === 'user' && f.showWorkload) });
  const { user } = useAuth();
  const isScoped = isNarrowAccess(user);

  useEffect(() => {
    if (!open) return;
    const initial = { ...defaults };
    for (const field of fields) {
      const raw = record?.[field.name];
      if (raw === undefined || raw === null) {
        // An owner field starts on the signed-in user rather than blank. The
        // server already falls back to the creator, but leaving the control
        // empty hid who the record would belong to — and made it easy to hand
        // it to someone else by accident.
        if (field.defaultToMe && !record?._id && user?.id) initial[field.name] ??= user.id;
        initial[field.name] ??= field.type === 'checkbox' ? false : '';
        continue;
      }
      if (field.type === 'date') initial[field.name] = String(raw).slice(0, 10);
      else if (field.type === 'datetime') initial[field.name] = String(raw).slice(0, 16);
      else if (typeof raw === 'object' && raw._id) initial[field.name] = raw._id;   // populated ref
      else initial[field.name] = raw;
    }
    setValues(initial);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const isEdit = !!record?._id;
      let payload = {};
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) continue;
        if (value === '') {
          // On a new record a blank simply means "not set", so it is omitted.
          // On an edit it means the user cleared a field that had a value, so
          // send an explicit null — otherwise the old value could never be removed.
          const had = record?.[key];
          if (isEdit && had !== undefined && had !== null && had !== '') payload[key] = null;
          continue;
        }
        payload[key] = value;
      }
      if (transform) payload = transform(payload);

      const res = isEdit
        ? await api.put(`${endpoint}/${record._id}`, payload)
        : await api.post(endpoint, payload);

      onSaved?.(res.data);
      onClose();
    } catch (err) {
      setError([err.message, ...(err.errors || [])].join(' · '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || (record?._id ? 'Edit record' : 'New record')}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="record-form" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : record?._id ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div>}

      <form id="record-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const value = values[field.name] ?? '';
          const span = field.span === 2 ? 'sm:col-span-2' : '';

          if (field.type === 'checkbox') {
            return (
              <label key={field.name} className={`flex items-center gap-2.5 ${span}`}>
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={!!values[field.name]} onChange={(e) => set(field.name, e.target.checked)} />
                <span className="text-sm text-slate-700">{field.label}</span>
              </label>
            );
          }

          // Handing a record to someone else puts it outside what a scoped role
          // can see, so the record vanishes the moment it saves. Say so here,
          // before the save, rather than leaving an unchanged list to explain it.
          const givingAway = field.defaultToMe && isScoped && value && String(value) !== String(user?.id);
          const newOwner = givingAway && users.find((u) => String(u._id) === String(value));
          const hint = givingAway ? (
            <span className="font-medium text-amber-700">
              Saving assigns this to {newOwner ? (newOwner.fullName || `${newOwner.firstName} ${newOwner.lastName || ''}`.trim()) : 'another user'}.
              {' '}Your role only shows records you own, so it will disappear from your list.
            </span>
          ) : field.hint;

          return (
            <Field key={field.name} label={field.label} required={field.required} hint={hint} className={span}>
              {field.type === 'textarea' ? (
                <textarea className="input" rows={field.rows || 3} required={field.required} placeholder={field.placeholder}
                  value={value} onChange={(e) => set(field.name, e.target.value)} />
              ) : field.type === 'user' ? (
                <UserSelect
                  users={users}
                  value={value}
                  required={field.required}
                  placeholder={field.placeholder ?? 'Unassigned'}
                  showWorkload={field.showWorkload}
                  onChange={(e) => set(field.name, e.target.value)}
                />
              ) : field.type === 'select' ? (
                <Select options={field.options || []} required={field.required} value={value}
                  placeholder={field.placeholder ?? 'Select…'} onChange={(e) => set(field.name, e.target.value)} />
              ) : field.type === 'date' || field.type === 'datetime' ? (
                <DatePicker
                  value={value}
                  withTime={field.type === 'datetime'}
                  required={field.required}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                  onChange={(e) => set(field.name, e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  type={{ money: 'number', datetime: 'datetime-local' }[field.type] || field.type || 'text'}
                  step={field.type === 'money' || field.type === 'number' ? field.step || 'any' : undefined}
                  min={field.min}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={value}
                  onChange={(e) => set(field.name, field.type === 'number' || field.type === 'money' ? e.target.valueAsNumber || 0 : e.target.value)}
                />
              )}
            </Field>
          );
        })}
      </form>
    </Modal>
  );
}
