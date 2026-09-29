import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { assetUrl } from '../lib/config.js';
import { useList, useFetch, useMutation, useMasterNames, invalidateMasters, invalidateUsers } from '../hooks/useApi.js';
import DataTable from '../components/DataTable.jsx';
import RecordForm from '../components/RecordForm.jsx';
import { SimpleTable } from './Accounts.jsx';
import {
  PageHeader, Badge, Avatar, Loading, ErrorState, EmptyState, Toast, errorToast, Modal, Field, Select, UserSelect,
  SearchInput, Tabs, ConfirmDialog, Spinner,
} from '../components/ui.jsx';
import { date, dateTime, fromNow, nameOf } from '../lib/format.js';
import { useAuth, GROUPS, ROLE_LABEL } from '../lib/auth.jsx';
import IntegrationSettings from './Integrations.jsx';

/** Column layout for the reference lists that keep their own shape. */
const DEDICATED_FIELDS = {
  currencies: [['code', 'Code'], ['name', 'Name'], ['symbol', 'Symbol'], ['exchangeRate', 'Rate', 'number']],
  taxes: [['name', 'Name'], ['percentage', 'Percentage', 'number']],
  countries: [['name', 'Name'], ['isoCode', 'ISO code'], ['phoneCode', 'Phone code']],
  states: [['name', 'Name'], ['code', 'Code']],
  cities: [['name', 'Name']],
};

const FLAG_LABELS = {
  isWon: 'Won', isLost: 'Lost', isFinal: 'Final', isDefault: 'Default',
};

export default function Settings() {
  const { user, can } = useAuth();
  const [tab, setTab] = useState('company');
  const isAdmin = can(GROUPS.ADMINS);

  const tabs = [
    { key: 'company', label: 'Company' },
    ...(isAdmin ? [{ key: 'users', label: 'Users' }] : []),
    { key: 'roles', label: 'Roles' },
    { key: 'departments', label: 'Departments' },
    { key: 'masters', label: 'Master data' },
    { key: 'notifications', label: 'Notifications' },
    ...(isAdmin ? [{ key: 'email', label: 'Email' }] : []),
    ...(isAdmin ? [{ key: 'integrations', label: 'Integrations' }] : []),
    ...(isAdmin ? [{ key: 'audit', label: 'Audit log' }] : []),
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle="Company profile, users, permissions and reference data." />
      <Tabs active={tab} onChange={setTab} tabs={tabs} />
      {tab === 'company' && <CompanySettings readOnly={!isAdmin} />}
      {tab === 'users' && <UserManagement />}
      {tab === 'roles' && <RoleMatrix readOnly={!isAdmin} />}
      {tab === 'departments' && <Departments readOnly={!isAdmin} />}
      {tab === 'masters' && <MasterData readOnly={!isAdmin} />}
      {tab === 'notifications' && <NotificationSettings readOnly={!isAdmin} />}
      {tab === 'email' && <EmailSettings />}
      {tab === 'integrations' && <IntegrationSettings />}
      {tab === 'audit' && <AuditLog />}
    </>
  );
}

// ---------------------------------------------------------------- Company

function CompanySettings({ readOnly }) {
  const { data, loading, refresh } = useFetch('/settings');
  const [values, setValues] = useState({});
  const [toast, setToast] = useState('');
  const { run, pending, error } = useMutation();

  useEffect(() => { if (data?.Company) setValues(data.Company); }, [data]);
  if (loading) return <Loading />;

  // These appear on the quotation / sales order / invoice PDFs.
  const FIELDS = [
    ['company.name', 'Company name'],
    ['company.email', 'Email'],
    ['company.phone', 'Phone'],
    ['company.website', 'Website'],
    ['company.taxNumber', 'Tax / GST number'],
    ['company.currency', 'Base currency'],
    ['company.financialYearStart', 'Financial year start (MM-DD)'],
    ['company.address', 'Address'],
    ['company.bankDetails', 'Bank details (printed on invoices)'],
  ];

  return (
    <div className="card-pad max-w-3xl">
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <LogoSetting
        logo={values['company.logo']}
        readOnly={readOnly}
        onUploaded={(logo) => { setValues((v) => ({ ...v, 'company.logo': logo })); setToast('Logo updated'); refresh(); }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map(([key, label]) => (
          <Field key={key} label={label} className={['company.address', 'company.bankDetails'].includes(key) ? 'sm:col-span-2' : ''}>
            {key === 'company.bankDetails' ? (
              <textarea className="input" rows={2} disabled={readOnly} value={values[key] ?? ''}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                placeholder="Bank · A/C number · IFSC / SWIFT · Branch" />
            ) : (
              <input className="input" disabled={readOnly} value={values[key] ?? ''} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
            )}
          </Field>
        ))}
      </div>
      {!readOnly && (
        <div className="mt-5 flex justify-end">
          <button className="btn-primary" disabled={pending} onClick={async () => {
            await run((a) => a.put('/settings', { group: 'Company', values }));
            setToast('Company settings saved'); refresh();
          }}>{pending ? <Spinner className="h-4 w-4" /> : 'Save changes'}</button>
        </div>
      )}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  );
}

/** Company logo — appears in the header of every generated document PDF. */
function LogoSetting({ logo, readOnly, onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('logo', file);
      const res = await api.upload('/settings/logo', form);
      onUploaded(res.data.logo);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="mb-5 border-b border-slate-100 pb-5">
      <span className="label">Logo</span>
      <div className="mt-1 flex items-center gap-4">
        <div className="grid h-16 w-40 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {logo
            ? <img src={assetUrl(logo)} alt="Company logo" className="max-h-full max-w-full object-contain" />
            : <span className="text-xs text-slate-400">No logo</span>}
        </div>
        {!readOnly && (
          <div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? <Spinner className="h-4 w-4" /> : logo ? 'Replace logo' : 'Upload logo'}
            </button>
            <p className="mt-1 text-xs text-slate-400">PNG or JPG, around 300×100 for a crisp document header.</p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- Users

function UserManagement() {
  const list = useList('/users');
  const departments = useFetch('/departments', { limit: 100 });
  const { data: allUsers } = useFetch('/users/assignable');
  const [form, setForm] = useState(null);
  const [resetFor, setResetFor] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [toast, setToast] = useState('');

  const designations = useMasterNames('designation', []);
  const teams = useMasterNames('team', []);
  const territories = useMasterNames('territory', []);
  const employmentTypes = useMasterNames('employment-type', []);
  const shifts = useMasterNames('shift-timing', []);
  const userStatuses = useMasterNames('user-status', []);

  const fields = [
    { name: 'firstName', label: 'First name', required: true },
    { name: 'lastName', label: 'Last name' },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'role', label: 'Role', type: 'select', required: true, options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })) },
    // Each of these is backed by a master list, so an administrator adds a new
    // designation or territory under Master data rather than asking for a
    // release. Falling back to free text would let the lists drift again.
    { name: 'designation', label: 'Designation', type: 'select', options: designations },
    { name: 'department', label: 'Department', type: 'select', options: (departments.data || []).map((d) => ({ value: d._id, label: d.name })) },
    { name: 'team', label: 'Team', type: 'select', options: teams },
    { name: 'territory', label: 'Territory', type: 'select', options: territories },
    { name: 'manager', label: 'Reports to', type: 'user' },
    { name: 'employeeCode', label: 'Employee code' },
    { name: 'employmentType', label: 'Employment type', type: 'select', options: employmentTypes },
    { name: 'shiftTiming', label: 'Shift', type: 'select', options: shifts },
    { name: 'userStatus', label: 'Working status', type: 'select', options: userStatuses },
    { name: 'monthlyTarget', label: 'Monthly target', type: 'money', min: 0 },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
    { name: 'mfaEnabled', label: 'Require two-factor authentication', type: 'checkbox' },
  ];

  return (
    <>
      <DataTable
        list={list} title="users" exportName="users" onRowClick={(r) => setForm(r)}
        emptyTitle="No users"
        actions={<button className="btn-primary btn-sm" onClick={() => setForm({})}>New user</button>}
        filters={[{ key: 'role', label: 'All roles', options: Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label })) }]}
        columns={[
          { key: 'firstName', label: 'User', sortable: true, render: (r) => (
            <span className="inline-flex items-center gap-2.5">
              <Avatar name={r.fullName} url={r.avatarUrl} />
              <span><span className="font-medium">{r.fullName}</span><span className="block text-xs text-slate-400">{r.email}</span></span>
            </span>
          ), exportValue: (r) => r.fullName },
          { key: 'role', label: 'Role', sortable: true, render: (r) => <Badge tone="bg-brand-50 text-brand-700">{ROLE_LABEL[r.role] || r.role}</Badge> },
          { key: 'designation', label: 'Designation' },
          { key: 'department', label: 'Department', render: (r) => nameOf(r.department), exportValue: (r) => nameOf(r.department) },
          { key: 'manager', label: 'Reports to', render: (r) => nameOf(r.manager), exportValue: (r) => nameOf(r.manager) },
          { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{r.isActive ? 'Active' : 'Disabled'}</Badge> },
          { key: 'lastLoginAt', label: 'Last sign-in', sortable: true, render: (r) => (r.lastLoginAt ? fromNow(r.lastLoginAt) : 'Never') },
          { key: 'actions', label: '', render: (r) => (
            <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setResetFor(r); }}>Reset password</button>
          ) },
        ]}
      />

      {/* The assignable-user list is cached app-wide, so it must be dropped or a
          newly created colleague never appears in any owner/assignee picker. */}
      <RecordForm open={!!form} onClose={() => setForm(null)}
        onSaved={() => { invalidateUsers(); list.refresh(); setToast('User saved'); }}
        title={form?._id ? 'Edit user' : 'New user'} endpoint="/users" record={form} fields={fields}
        defaults={{ role: 'SalesExecutive', isActive: true }} />

      <ConfirmDialog
        open={!!resetFor} onClose={() => setResetFor(null)} confirmLabel="Reset password"
        title={`Reset password for ${resetFor?.fullName}?`}
        message="A temporary password is generated and emailed to the user, who must change it at next sign-in."
        onConfirm={async () => {
          const res = await api.post(`/users/${resetFor._id}/reset-password`, {});
          setTempPassword(res.data.temporaryPassword);
        }}
      />

      <Modal open={!!tempPassword} onClose={() => setTempPassword('')} title="Temporary password" width="max-w-md">
        <p className="text-sm text-slate-600">Share this with the user if the email does not reach them:</p>
        <p className="mt-3 rounded-lg bg-slate-100 px-4 py-3 text-center font-mono text-lg">{tempPassword}</p>
      </Modal>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

// ---------------------------------------------------------------- Roles

function RoleMatrix({ readOnly }) {
  const { data, loading, refresh } = useFetch('/settings/roles');
  const levelsQuery = useFetch('/settings/access-levels');
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');

  const levels = levelsQuery.data || [];
  if (loading) return <Loading />;

  return (
    <>
      <SimpleTable rows={data || []} empty="No roles configured"
        columns={[
          ['Role', (r) => <span className="font-medium">{ROLE_LABEL[r.name] || r.name}</span>],
          ['Description', (r) => r.description || '—'],
          ['Users', (r) => r.userCount],
          ['Permissions', (r) => `${r.permissions?.length || 0} granted`],
          // Permissions say which screens open; the access level says whose
          // records are inside them. Both belong on this row.
          ['Data access', (r) => {
            const level = levels.find((l) => l.key === (r.accessLevel || 'own'));
            return <Badge tone="bg-slate-100 text-slate-700">{level?.label || 'Own records only'}</Badge>;
          }],
          ['', (r) => (readOnly ? null : <button className="btn-ghost btn-sm" onClick={() => setEditing(r)}>Edit</button>)],
        ]} />
      <PermissionEditor role={editing} levels={levels} onClose={() => setEditing(null)} onDone={() => { refresh(); setToast('Role updated'); }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

const MODULES = ['leads', 'customers', 'companies', 'contacts', 'opportunities', 'activities', 'tasks',
  'products', 'quotations', 'orders', 'invoices', 'payments', 'campaigns', 'tickets', 'reports', 'settings'];
const ACTIONS = ['view', 'create', 'update', 'delete', 'approve', 'export'];

function PermissionEditor({ role, levels, onClose, onDone }) {
  const [permissions, setPermissions] = useState([]);
  const [accessLevel, setAccessLevel] = useState('own');
  const { run, pending, error } = useMutation();
  useEffect(() => {
    setPermissions(role?.permissions || []);
    setAccessLevel(role?.accessLevel || 'own');
  }, [role]);
  if (!role) return null;

  const toggle = (code) => setPermissions((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
  const toggleModule = (module) => {
    const codes = ACTIONS.map((a) => `${module}.${a}`);
    const allOn = codes.every((c) => permissions.includes(c));
    setPermissions((p) => (allOn ? p.filter((c) => !codes.includes(c)) : [...new Set([...p, ...codes])]));
  };

  return (
    <Modal open onClose={onClose} title={`${ROLE_LABEL[role.name] || role.name} — access`} width="max-w-3xl"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          try {
            await run((a) => a.put(`/settings/roles/${role._id}`, { permissions, accessLevel }));
            onDone(); onClose();
          } catch { /* message shown above the matrix */ }
        }}>Save</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {/* Deliberately above the matrix: it is the wider of the two controls. A
          role can be granted "leads.view" and still only ever see its own rows,
          which is baffling until you have met this setting. */}
      <div className="mb-5 rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Data access level</h4>
        <p className="mb-3 text-xs text-slate-500">
          Which records this role can see. The permissions below decide what it may do with them.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {levels.map((level) => (
            <label
              key={level.key}
              className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition
                ${accessLevel === level.key ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <input
                type="radio" name="accessLevel" className="mt-0.5 h-4 w-4 border-slate-300 text-brand-600"
                checked={accessLevel === level.key} onChange={() => setAccessLevel(level.key)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">{level.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{level.description}</span>
              </span>
            </label>
          ))}
        </div>
        {role.name === 'Customer' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            The portal login is always pinned to its own customer account, whatever is chosen here.
          </p>
        )}
      </div>

      <h4 className="mb-2 text-sm font-semibold text-slate-900">Permissions</h4>
      <div className="table-wrap">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr><th className="th">Module</th>{ACTIONS.map((a) => <th key={a} className="th text-center capitalize">{a}</th>)}</tr>
          </thead>
          <tbody>
            {MODULES.map((module) => (
              <tr key={module} className="border-t border-slate-100">
                <td className="td">
                  <button className="font-medium capitalize text-slate-800 hover:text-brand-700" onClick={() => toggleModule(module)}>{module}</button>
                </td>
                {ACTIONS.map((action) => {
                  const code = `${module}.${action}`;
                  return (
                    <td key={code} className="px-4 py-2 text-center">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                        checked={permissions.includes(code)} onChange={() => toggle(code)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">Click a module name to toggle the whole row. Route-level access is enforced by role on the server; this matrix drives finer-grained checks.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------- Departments

function Departments({ readOnly }) {
  const list = useList('/departments');
  const { data: users } = useFetch('/users/assignable');
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  return (
    <>
      <DataTable
        list={list} title="departments" onRowClick={readOnly ? undefined : (r) => setForm(r)}
        emptyTitle="No departments"
        actions={!readOnly && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New department</button>}
        columns={[
          { key: 'name', label: 'Department', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'code', label: 'Code' },
          { key: 'manager', label: 'Manager', render: (r) => nameOf(r.manager), exportValue: (r) => nameOf(r.manager) },
          { key: 'createdAt', label: 'Created', render: (r) => date(r.createdAt) },
        ]}
      />
      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); setToast('Saved'); }}
        title={form?._id ? 'Edit department' : 'New department'} endpoint="/departments" record={form}
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'code', label: 'Code' },
          { name: 'manager', label: 'Manager', type: 'user' },
        ]} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

// ---------------------------------------------------------------- Master data

/**
 * Manages every configurable list in the system. The catalogue comes from the
 * server, so a list added in `MASTER_TYPES` shows up here without a UI change.
 */
function MasterData({ readOnly }) {
  const catalogue = useFetch('/settings/masters');
  const [key, setKey] = useState('lead-status');
  const [search, setSearch] = useState('');
  const { data, loading, refresh } = useFetch(`/settings/masters/${key}`);
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');
  const { run } = useMutation();

  const lists = catalogue.data || [];
  const config = lists.find((m) => m.key === key);

  const grouped = useMemo(() => {
    const filtered = lists.filter((m) => m.label.toLowerCase().includes(search.toLowerCase()));
    return filtered.reduce((acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    }, {});
  }, [lists, search]);

  // Every write reports its outcome — a silent failure here looks like the
  // entry saved when it did not.
  const save = async (values) => {
    try {
      if (form?._id) await run((a) => a.put(`/settings/masters/${key}/${form._id}`, values));
      else await run((a) => a.post(`/settings/masters/${key}`, values));
      invalidateMasters();
      refresh();
      catalogue.refresh();
      setForm(null);
      setToast('Saved');
    } catch (err) {
      setToast(errorToast(err));
      throw err;   // keeps the form open with its values intact
    }
  };

  const remove = async (row) => {
    try {
      const res = await api.del(`/settings/masters/${key}/${row._id}`);
      invalidateMasters();
      refresh();
      catalogue.refresh();
      setToast(res.data?.deactivated ? 'System entry deactivated' : 'Deleted');
    } catch (err) {
      setToast(errorToast(err));
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.put(`/settings/masters/${key}/${row._id}`, { isActive: !row.isActive });
      invalidateMasters();
      refresh();
      setToast(row.isActive ? 'Hidden from dropdowns' : 'Enabled');
    } catch (err) {
      setToast(errorToast(err));
    }
  };

  if (catalogue.loading) return <Loading label="Loading master lists…" />;

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      {/*
        The list index is long (30+ entries). It scrolls inside its own pane and
        sticks alongside the table, so picking a list never means scrolling the
        page past the content it controls.
      */}
      <nav className="rounded-xl border border-slate-200 bg-white lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="sticky top-0 z-10 rounded-t-xl border-b border-slate-100 bg-white p-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Find a list…" className="w-full" />
        </div>
        <div className="space-y-3 p-2">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
              <div className="space-y-0.5">
                {items.map((m) => (
                  <button key={m.key} onClick={() => setKey(m.key)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition ${
                      key === m.key ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <span className="truncate">{m.label}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-500">{m.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!Object.keys(grouped).length && (
            <p className="px-2 py-6 text-center text-sm text-slate-400">No list matches “{search}”</p>
          )}
        </div>
      </nav>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{config?.label || key}</h3>
            <p className="text-xs text-slate-500">
              {(data?.length ?? 0)} {(data?.length === 1 ? 'entry' : 'entries')}
              {config?.entity ? ` · drives the ${config.entity} record` : ''}
            </p>
          </div>
          {!readOnly && <button className="btn-primary btn-sm" onClick={() => setForm({})}>Add entry</button>}
        </div>

        {loading ? <Loading /> : (
          <div className="overflow-x-auto">
            <SimpleTable
              rows={data || []}
              empty={`No entries in ${config?.label?.toLowerCase() || key}`}
              columns={masterColumns({ config, readOnly, setForm, remove, toggleActive })}
            />
          </div>
        )}

        {config?.generic && (
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-500">
            Renaming an entry changes the label everywhere it appears. Entries marked <em>system</em> back application
            logic — they can be renamed or hidden, but not deleted. Hidden entries stay on existing records and simply
            stop appearing in dropdowns.
          </p>
        )}
      </div>

      {form && (
        <MasterForm
          config={config}
          fields={config?.generic ? null : (DEDICATED_FIELDS[key] || [['name', 'Name']])}
          record={form}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  );
}

function masterColumns({ config, readOnly, setForm, remove, toggleActive }) {
  const actions = ['', (r) => (readOnly ? null : (
    <span className="flex justify-end gap-1">
      <button className="btn-ghost btn-sm" onClick={() => setForm(r)}>Edit</button>
      {config?.generic && (
        <button className="btn-ghost btn-sm" onClick={() => toggleActive(r)}>{r.isActive ? 'Hide' : 'Enable'}</button>
      )}
      <button className="btn-ghost btn-sm text-rose-600" onClick={() => remove(r)}>Delete</button>
    </span>
  ))];

  if (!config?.generic) {
    const fields = DEDICATED_FIELDS[config?.key] || [['name', 'Name']];
    return [...fields.map(([name, label]) => [label, (r) => String(r[name] ?? '—')]), actions];
  }

  return [
    ['Name', (r) => (
      <span className="inline-flex items-center gap-2">
        {config.supportsColor && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />}
        <span className={`font-medium ${r.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{r.name}</span>
      </span>
    )],
    ['Order', (r) => <span className="tabular-nums text-slate-500">{r.sortOrder}</span>],
    ...(config.supportsProbability ? [['Probability', (r) => (r.probability != null ? `${r.probability}%` : '—')]] : []),
    ['Flags', (r) => {
      const flags = ['isDefault', ...(config.flags || [])].filter((f) => r[f]);
      if (!flags.length && r.isSystem) return <span className="chip bg-slate-100 text-slate-500">system</span>;
      return (
        <span className="flex flex-wrap gap-1">
          {flags.map((f) => <span key={f} className="chip bg-brand-50 text-brand-700">{FLAG_LABELS[f] || f}</span>)}
          {r.isSystem && <span className="chip bg-slate-100 text-slate-500">system</span>}
        </span>
      );
    }],
    ['Status', (r) => (
      <Badge tone={r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
        {r.isActive ? 'Active' : 'Hidden'}
      </Badge>
    )],
    actions,
  ];
}

function MasterForm({ config, fields, record, onClose, onSave }) {
  const generic = !!config?.generic;
  const [values, setValues] = useState(() => (generic
    ? {
      name: record?.name ?? '',
      code: record?.code ?? '',
      description: record?.description ?? '',
      color: record?.color ?? '#64748b',
      sortOrder: record?.sortOrder ?? 0,
      probability: record?.probability ?? '',
      isDefault: !!record?.isDefault,
      isActive: record?.isActive !== false,
      ...Object.fromEntries((config?.flags || []).map((f) => [f, !!record?.[f]])),
    }
    : Object.fromEntries((fields || []).map(([name]) => [name, record?.[name] ?? '']))));
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));
  const title = `${record?._id ? 'Edit' : 'New'} ${(config?.label || 'entry').toLowerCase().replace(/s$/, '')}`;

  const submit = async () => {
    setBusy(true);
    try {
      const payload = generic
        ? { ...values, probability: values.probability === '' ? undefined : Number(values.probability) }
        : Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
      await onSave(payload);
    } catch {
      // The parent has already shown the message; leave the entry on screen.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} width="max-w-lg"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={busy || (generic && !values.name)} onClick={submit}>
          {busy ? <Spinner className="h-4 w-4" /> : 'Save'}
        </button></>}>
      {!generic ? (
        <div className="space-y-4">
          {(fields || []).map(([name, label, type]) => (
            <Field key={name} label={label}>
              <input className="input" type={type === 'number' ? 'number' : 'text'} value={values[name]}
                onChange={(e) => set(name, type === 'number' ? e.target.valueAsNumber || 0 : e.target.value)} />
            </Field>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required className="sm:col-span-2">
              <input className="input" value={values.name} onChange={(e) => set('name', e.target.value)} autoFocus />
            </Field>
            <Field label="Code" hint="Optional short key for integrations.">
              <input className="input" value={values.code} onChange={(e) => set('code', e.target.value)} />
            </Field>
            <Field label="Display order">
              <input className="input" type="number" value={values.sortOrder} onChange={(e) => set('sortOrder', e.target.valueAsNumber || 0)} />
            </Field>
            {config.supportsColor && (
              <Field label="Colour" hint="Used by the status badge.">
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-12 cursor-pointer rounded border border-slate-300"
                    value={values.color} onChange={(e) => set('color', e.target.value)} />
                  <input className="input" value={values.color} onChange={(e) => set('color', e.target.value)} />
                </div>
              </Field>
            )}
            {config.supportsProbability && (
              <Field label="Win probability %" hint="Drives the weighted pipeline forecast.">
                <input className="input" type="number" min="0" max="100" value={values.probability}
                  onChange={(e) => set('probability', e.target.value)} />
              </Field>
            )}
            <Field label="Description" className="sm:col-span-2">
              <input className="input" value={values.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={values.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
              Default — pre-selected on new records
            </label>
            {(config.flags || []).map((flag) => (
              <label key={flag} className="flex items-center gap-2.5 text-sm text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={!!values[flag]} onChange={(e) => set(flag, e.target.checked)} />
                {{ isWon: 'Counts as won', isLost: 'Counts as lost', isFinal: 'Terminal state — no further transitions' }[flag] || flag}
              </label>
            ))}
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600"
                checked={values.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Active — appears in dropdowns
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Notifications

function NotificationSettings({ readOnly }) {
  const { data, loading, refresh } = useFetch('/settings');
  const [values, setValues] = useState({});
  const [toast, setToast] = useState('');
  const { run, pending, error } = useMutation();

  useEffect(() => { if (data?.Notifications) setValues(data.Notifications); }, [data]);
  if (loading) return <Loading />;

  const TOGGLES = [
    ['notifications.emailEnabled', 'Send email notifications', 'Turns outbound notification email on or off globally.'],
    ['notifications.leadAssigned', 'Lead assigned', 'Notify the owner whenever a lead is assigned to them.'],
    ['notifications.followUpReminder', 'Follow-up reminders', 'Remind owners ahead of scheduled follow-ups.'],
    ['notifications.meetingReminder', 'Meeting reminders', 'Remind attendees before a meeting starts.'],
    ['notifications.quotationApproved', 'Quotation approved', 'Tell the owner when their quotation is approved.'],
    ['notifications.dealWonLost', 'Deal won or lost', 'Notify the team when a deal closes either way.'],
    ['notifications.invoiceDue', 'Invoice due', 'Alert finance when an invoice passes its due date.'],
    ['notifications.paymentReceived', 'Payment received', 'Confirm collections to the invoice owner.'],
    ['notifications.ticketUpdate', 'Support ticket updates', 'Notify on ticket replies, escalation and resolution.'],
  ];

  return (
    <div className="card-pad max-w-3xl">
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {TOGGLES.map(([key, label, hint]) => (
          <li key={key} className="flex items-start justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="text-xs text-slate-500">{hint}</p>
            </div>
            <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600" disabled={readOnly}
              checked={values[key] !== false} onChange={(e) => setValues({ ...values, [key]: e.target.checked })} />
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" disabled={pending} onClick={async () => {
            await run((a) => a.put('/settings', { group: 'Notifications', values }));
            setToast('Notification settings saved'); refresh();
          }}>Save changes</button>
        </div>
      )}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  );
}

// ---------------------------------------------------------------- Audit log

function AuditLog() {
  const list = useList('/audit-logs', { limit: 50 });
  return (
    <DataTable
      list={list} title="audit entries" exportName="audit-log"
      emptyTitle="No audit entries"
      filters={[{ key: 'action', label: 'All actions', options: ['Create', 'Update', 'Delete', 'Login', 'Logout', 'Convert', 'Approve', 'Payment', 'Escalate', 'Import'] }]}
      columns={[
        { key: 'createdAt', label: 'When', sortable: true, render: (r) => dateTime(r.createdAt) },
        { key: 'userName', label: 'User', render: (r) => r.userName || nameOf(r.user) },
        { key: 'action', label: 'Action', render: (r) => <Badge tone="bg-slate-100 text-slate-700">{r.action}</Badge> },
        { key: 'entityType', label: 'Entity' },
        { key: 'description', label: 'Description' },
        { key: 'ipAddress', label: 'IP' },
      ]}
    />
  );
}

// ---------------------------------------------------------------- Profile & password

export function Profile() {
  const { user, patchUser } = useAuth();
  const [form, setForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '', designation: user?.designation || '' });
  const [toast, setToast] = useState('');
  const { run, pending, error } = useMutation();

  return (
    <>
      <PageHeader title="My profile" subtitle="Your details and security options." />
      <div className="grid max-w-3xl gap-4">
        <div className="card-pad">
          {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="mb-5 flex items-center gap-4">
            <Avatar name={user?.fullName} url={user?.avatarUrl} size="h-14 w-14" />
            <div>
              <p className="text-base font-semibold text-slate-900">{user?.fullName}</p>
              <p className="text-sm text-slate-500">{user?.email} · {ROLE_LABEL[user?.role] || user?.role}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name"><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Last name"><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Designation"><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
          </div>
          <div className="mt-5 flex justify-end">
            <button className="btn-primary" disabled={pending} onClick={async () => {
              const res = await run((a) => a.patch('/auth/me', form));
              patchUser(res.data); setToast('Profile updated');
            }}>Save changes</button>
          </div>
        </div>

        <div className="card-pad">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Two-factor authentication</p>
              <p className="text-xs text-slate-500">Require a one-time code sent to your email at every sign-in.</p>
            </div>
            <button
              className={user?.mfaEnabled ? 'btn-ghost btn-sm' : 'btn-primary btn-sm'}
              onClick={async () => {
                const res = await run((a) => a.post('/auth/mfa', { enabled: !user?.mfaEnabled }));
                patchUser(res.data);
                setToast(res.data.mfaEnabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled');
              }}
            >
              {user?.mfaEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </div>
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

export function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [toast, setToast] = useState('');
  const { run, pending, error, setError } = useMutation();

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setError('New passwords do not match');
    await run((a) => a.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword }));
    setForm({ currentPassword: '', newPassword: '', confirm: '' });
    setToast('Password changed');
  };

  return (
    <>
      <PageHeader title="Change password" subtitle="Pick something you haven't used before." />
      <form onSubmit={submit} className="card-pad max-w-md space-y-4">
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Field label="Current password"><input className="input" type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
        <Field label="New password" hint="At least 8 characters, with a letter and a number.">
          <input className="input" type="password" required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        </Field>
        <Field label="Confirm new password"><input className="input" type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={pending}>{pending ? <Spinner className="h-4 w-4" /> : 'Update password'}</button>
      </form>
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

// ---------------------------------------------------------------- Email / SMTP

/**
 * Shows what the server is configured to send through, and proves it works.
 *
 * SMTP fails in ways that look identical from the outside — wrong port for the
 * TLS mode, an unverified sender, a blocked outbound port — and until now the
 * only way to tell them apart was to email a customer and read the server log.
 */
function EmailSettings() {
  const { data, loading, error, refresh } = useFetch('/settings/email');
  const [to, setTo] = useState('');
  const [sent, setSent] = useState(null);
  const [toast, setToast] = useState('');
  const { run, pending, error: sendError } = useMutation();

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const rows = [
    ['Server', data.configured ? `${data.host}:${data.port}` : 'Not configured'],
    ['Encryption', data.secure ? 'SSL/TLS from connect' : data.requireTLS ? 'STARTTLS (upgraded)' : 'None'],
    ['Username', data.user || <span className="text-rose-600">Not set</span>],
    ['Password', data.hasPassword ? '••••••••' : <span className="text-rose-600">Not set</span>],
    ['From address', data.from],
    ['Inbound mail', data.inbound ? 'Enabled' : 'Not enabled'],
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div className={`rounded-xl px-4 py-3 text-sm ${data.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
        <p className="font-semibold">{data.ok ? 'Mail is working' : 'Mail is not ready'}</p>
        <p className="mt-0.5">{data.message}</p>
      </div>

      <div className="card-pad">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Outgoing mail</h3>
        <p className="mb-3 text-xs text-slate-500">Set in the server&rsquo;s .env file; restart the API after changing it.</p>
        <dl className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="text-right text-sm text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card-pad">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Send a test message</h3>
        <p className="mb-3 text-xs text-slate-500">
          A connection check proves the password; only a real send proves the relay accepts your From address.
        </p>
        {sendError && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{sendError}</p>}
        {sent && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Sent to {sent.to}{sent.messageId ? ` — id ${sent.messageId}` : ''}.
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Send to" className="min-w-[16rem] flex-1">
            <input className="input" type="email" placeholder="you@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <button className="btn-primary" disabled={pending} onClick={async () => {
            try {
              const res = await run((a) => a.post('/settings/email/test', { to: to || undefined }));
              setSent(res.data); setToast('Test message sent'); refresh();
            } catch { /* message shown above */ }
          }}>
            {pending ? <Spinner className="h-4 w-4" /> : 'Send test'}
          </button>
        </div>
      </div>

      {data.inboundUrl && (
        <div className="card-pad">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">Incoming mail</h3>
          <p className="mb-3 text-xs text-slate-500">
            SMTP only sends. To receive, point your provider&rsquo;s inbound/parse webhook at this URL and set
            MAIL_INBOUND_SECRET on the server. Messages arrive in Engage &rarr; Email &rarr; Inbox, matched to the
            lead, contact or customer they came from.
          </p>
          <code className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">{data.inboundUrl}</code>
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  );
}
