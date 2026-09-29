import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useList, useFetch, useUsers, useMasterNames, useCurrencyCodes, useMutation } from '../hooks/useApi.js';
import DataTable from '../components/DataTable.jsx';
import RecordForm from '../components/RecordForm.jsx';
import { SimpleTable } from './Accounts.jsx';
import {
  PageHeader, Badge, Loading, ErrorState, EmptyState, Toast, errorToast, Modal, Field, Select, UserSelect, DatePicker,
  DetailGrid, Tabs, ConfirmDialog, Spinner,
} from '../components/ui.jsx';
import TrackingPanel from '../components/TrackingPanel.jsx';
import AttachmentsPanel from '../components/AttachmentsPanel.jsx';
import { money, date, dateTime, nameOf, percent } from '../lib/format.js';
import { useAuth, GROUPS } from '../lib/auth.jsx';

// Fallbacks only - live options come from the master lists in Settings.
const QUOTATION_STATUS = ['Draft', 'Pending Approval', 'Approved', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted'];
const ORDER_STATUS = ['Draft', 'Pending Approval', 'Approved', 'Processing', 'Delivered', 'Cancelled'];
const DELIVERY_STATUS = ['Pending', 'Packed', 'Shipped', 'Delivered', 'Returned'];
const INVOICE_STATUS = ['Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled', 'Credit Noted'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Cheque', 'Online', 'Bank Transfer'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Saves a server-rendered document PDF, reporting failures rather than doing nothing. */
async function downloadPdf(path, filename, onError) {
  try {
    await api.file(path, { download: true, filename });
  } catch (err) {
    onError?.(err.message);
  }
}

/**
 * A catalogue product as a document line: the price, unit, default discount and
 * tax all come from the product so a quotation starts from the real numbers.
 */
export function lineFromProduct(p, quantity = 1) {
  return {
    product: p._id,
    name: p.name,
    quantity,
    unit: p.unit || 'Nos',
    unitPrice: p.unitPrice || 0,
    discountPercent: p.defaultDiscountPercent || 0,
    taxPercent: p.taxPercent || 0,
  };
}

/** Mirrors the server's totals maths so the editor previews the same numbers. */
function computeTotals(items, extra = {}) {
  let subtotal = 0, discount = 0, tax = 0;
  for (const item of items) {
    const gross = round2((item.quantity || 0) * (item.unitPrice || 0));
    const d = round2(gross * ((item.discountPercent || 0) / 100));
    const t = round2((gross - d) * ((item.taxPercent || 0) / 100));
    subtotal += gross; discount += d; tax += t;
  }
  const additional = round2(extra.additionalDiscount || 0);
  return {
    subtotal: round2(subtotal),
    discount: round2(discount + additional),
    tax: round2(tax),
    grandTotal: round2(subtotal - discount - additional + tax + (extra.shippingCharges || 0) + (extra.adjustment || 0)),
  };
}

// ---------------------------------------------------------------- Products

export function Products() {
  const list = useList('/products');
  const units = useMasterNames('unit', ['Nos', 'User', 'Project', 'Year']);
  const categories = useFetch('/categories', { limit: 100 });
  const lowStock = useFetch('/products/low-stock');
  const { can } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [stockFor, setStockFor] = useState(null);
  const [toast, setToast] = useState('');
  // Products are catalogue data (admin-managed) but anyone in sales may quote them.
  const canWrite = can(GROUPS.ADMINS);
  const canQuote = can(GROUPS.SALES);
  const [selection, setSelection] = useState([]);
  const [quoting, setQuoting] = useState(null);

  /** Opens a new quotation pre-loaded with the ticked products. */
  const quoteSelected = () => {
    const chosen = selection
      .map((id) => (list.rows || []).find((p) => p._id === id))
      .filter(Boolean)
      .map((p) => lineFromProduct(p));
    if (!chosen.length) return;
    setQuoting({ items: chosen });
  };

  const fields = [
    { name: 'code', label: 'Product code', required: true },
    { name: 'name', label: 'Product name', required: true },
    { name: 'category', label: 'Category', type: 'select', options: (categories.data || []).map((c) => ({ value: c._id, label: c.name })) },
    { name: 'unit', label: 'Unit', type: 'select', options: units },
    { name: 'unitPrice', label: 'Selling price', type: 'money', required: true, min: 0 },
    { name: 'costPrice', label: 'Cost price', type: 'money', min: 0 },
    { name: 'taxPercent', label: 'Tax %', type: 'number', min: 0 },
    { name: 'defaultDiscountPercent', label: 'Default discount %', type: 'number', min: 0 },
    { name: 'stockQuantity', label: 'Stock quantity', type: 'number', min: 0 },
    { name: 'reorderLevel', label: 'Reorder level', type: 'number', min: 0 },
    { name: 'trackInventory', label: 'Track inventory', type: 'checkbox' },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
    { name: 'description', label: 'Description', type: 'textarea', span: 2 },
  ];

  return (
    <>
      <PageHeader title="Products" subtitle="Your catalogue, pricing and stock levels."
        actions={canWrite && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New product</button>} />

      {lowStock.data?.length > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {lowStock.data.length} product{lowStock.data.length > 1 ? 's are' : ' is'} at or below reorder level:{' '}
          {lowStock.data.slice(0, 4).map((p) => p.name).join(', ')}{lowStock.data.length > 4 ? '…' : ''}
        </p>
      )}

      <DataTable
        list={list} title="products" exportName="products" onRowClick={canWrite ? (r) => setForm(r) : undefined}
        emptyTitle="No products yet"
        selectable={canQuote}
        onSelectionChange={setSelection}
        actions={selection.length > 0 && canQuote
          ? <button className="btn-primary btn-sm" onClick={quoteSelected}>Quote {selection.length} product{selection.length > 1 ? 's' : ''}</button>
          : null}
        filters={[{ key: 'category', label: 'All categories', options: (categories.data || []).map((c) => ({ value: c._id, label: c.name })) }]}
        columns={[
          { key: 'code', label: 'Code', sortable: true, render: (r) => <span className="font-mono text-xs">{r.code}</span> },
          { key: 'name', label: 'Product', sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'category', label: 'Category', render: (r) => nameOf(r.category), exportValue: (r) => nameOf(r.category) },
          { key: 'unitPrice', label: 'Price', sortable: true, className: 'text-right', render: (r) => <span className="tabular-nums">{money(r.unitPrice)}</span> },
          { key: 'taxPercent', label: 'Tax', className: 'text-right', render: (r) => `${r.taxPercent || 0}%` },
          { key: 'stockQuantity', label: 'Stock', sortable: true, className: 'text-right', render: (r) => (
            !r.trackInventory ? <span className="text-slate-400">n/a</span>
              : <span className={`tabular-nums ${r.stockQuantity <= r.reorderLevel ? 'font-medium text-amber-600' : ''}`}>{r.stockQuantity}</span>
          ) },
          { key: 'actions', label: '', render: (r) => canWrite && r.trackInventory
            ? <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setStockFor(r); }}>Adjust</button>
            : null },
        ]}
      />

      <RecordForm open={!!form} onClose={() => setForm(null)} onSaved={() => { list.refresh(); lowStock.refresh(); setToast('Saved'); }}
        title={form?._id ? 'Edit product' : 'New product'} endpoint="/products" record={form} fields={fields}
        defaults={{ unit: 'Nos', trackInventory: true, isActive: true, taxPercent: 18 }} />

      <StockModal product={stockFor} onClose={() => setStockFor(null)} onDone={() => { list.refresh(); lowStock.refresh(); setToast('Stock updated'); }} />

      {/* Selected products open a new quotation already priced from the
          catalogue; the customer, quantities and prices are set in the form. */}
      {quoting && (
        <DocumentForm
          kind="quotation"
          doc={quoting}
          onClose={() => setQuoting(null)}
          onSaved={(quote) => { setQuoting(null); navigate(`/quotations/${quote._id}`); }}
        />
      )}

      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function StockModal({ product, onClose, onDone }) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const { run, pending, error } = useMutation();
  useEffect(() => { setDelta(0); setReason(''); }, [product]);
  if (!product) return null;

  return (
    <Modal open onClose={onClose} title={`Adjust stock — ${product.name}`} width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending || !delta} onClick={async () => {
          await run((a) => a.post(`/products/${product._id}/stock`, { delta, reason }));
          onDone(); onClose();
        }}>Apply</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <p className="mb-4 text-sm text-slate-600">Current stock: <span className="font-semibold">{product.stockQuantity}</span> {product.unit}</p>
      <div className="space-y-4">
        <Field label="Adjustment" hint="Use a negative number to reduce stock.">
          <input className="input" type="number" value={delta} onChange={(e) => setDelta(e.target.valueAsNumber || 0)} />
        </Field>
        <Field label="Reason"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Stock take, damage, purchase…" /></Field>
        <p className="text-sm text-slate-500">New level: <span className="font-semibold text-slate-800">{product.stockQuantity + delta}</span></p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Line item editor

export function LineItemEditor({ items, onChange, extra, onExtraChange, currency = 'INR' }) {
  const products = useFetch('/products', { limit: 200, sort: 'name' });
  const totals = useMemo(() => computeTotals(items, extra), [items, extra]);

  const update = (index, patch) => onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  const addProduct = (productId) => {
    const p = (products.data || []).find((x) => x._id === productId);
    if (!p) return;
    // Picking the same product again means "one more", not a second line —
    // duplicate rows for one product are almost never what was intended.
    const existing = items.findIndex((it) => String(it.product) === String(p._id));
    if (existing >= 0) {
      onChange(items.map((it, i) => (i === existing ? { ...it, quantity: (Number(it.quantity) || 0) + 1 } : it)));
      return;
    }
    onChange([...items, lineFromProduct(p)]);
  };

  return (
    <div className="space-y-3">
      <div className="table-wrap">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Item</th>
              <th className="th w-24 text-right">Qty</th>
              <th className="th w-32 text-right">Unit price</th>
              <th className="th w-24 text-right">Disc %</th>
              <th className="th w-24 text-right">Tax %</th>
              <th className="th w-32 text-right">Total</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Add a product or a custom line to begin.</td></tr>
            )}
            {items.map((item, i) => {
              const gross = (item.quantity || 0) * (item.unitPrice || 0);
              const net = gross - gross * ((item.discountPercent || 0) / 100);
              const total = net + net * ((item.taxPercent || 0) / 100);
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <input className="input" value={item.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Item description" />
                  </td>
                  <td className="px-2 py-2"><input className="input text-right" type="number" min="0.01" step="any" value={item.quantity} onChange={(e) => update(i, { quantity: e.target.valueAsNumber || 0 })} /></td>
                  <td className="px-2 py-2"><input className="input text-right" type="number" min="0" step="any" value={item.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.valueAsNumber || 0 })} /></td>
                  <td className="px-2 py-2"><input className="input text-right" type="number" min="0" max="100" value={item.discountPercent || 0} onChange={(e) => update(i, { discountPercent: e.target.valueAsNumber || 0 })} /></td>
                  <td className="px-2 py-2"><input className="input text-right" type="number" min="0" max="100" value={item.taxPercent || 0} onChange={(e) => update(i, { taxPercent: e.target.valueAsNumber || 0 })} /></td>
                  <td className="px-3 py-2 text-right text-sm font-medium tabular-nums text-slate-800">{money(total, currency)}</td>
                  <td className="px-2 py-2">
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(i)} aria-label="Remove line">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-80"
          searchable
          options={(products.data || []).map((p) => {
            const added = items.find((it) => String(it.product) === String(p._id));
            const stock = p.trackInventory ? `${p.stockQuantity} ${p.unit || 'in stock'}` : 'not stocked';
            return {
              value: p._id,
              label: `${p.code} — ${p.name}`,
              // Price and availability decide the choice, so they belong in the list.
              hint: [money(p.unitPrice), stock, added ? `already added ×${added.quantity}` : null].filter(Boolean).join(' · '),
            };
          })}
          value="" onChange={(e) => addProduct(e.target.value)} placeholder="Add product from catalogue…"
        />
        <button type="button" className="btn-ghost btn-sm"
          onClick={() => onChange([...items, { name: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 18 }])}>
          Add custom line
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Extra discount">
            <input className="input" type="number" min="0" value={extra.additionalDiscount || 0} onChange={(e) => onExtraChange({ ...extra, additionalDiscount: e.target.valueAsNumber || 0 })} />
          </Field>
          <Field label="Shipping">
            <input className="input" type="number" min="0" value={extra.shippingCharges || 0} onChange={(e) => onExtraChange({ ...extra, shippingCharges: e.target.valueAsNumber || 0 })} />
          </Field>
          <Field label="Adjustment">
            <input className="input" type="number" value={extra.adjustment || 0} onChange={(e) => onExtraChange({ ...extra, adjustment: e.target.valueAsNumber || 0 })} />
          </Field>
        </div>

        <dl className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{money(totals.subtotal, currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums text-rose-600">−{money(totals.discount, currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="tabular-nums">{money(totals.tax, currency)}</dd></div>
          {!!extra.shippingCharges && <div className="flex justify-between"><dt className="text-slate-500">Shipping</dt><dd className="tabular-nums">{money(extra.shippingCharges, currency)}</dd></div>}
          <div className="flex justify-between border-t border-slate-300 pt-1.5 text-base font-semibold text-slate-900">
            <dt>Grand total</dt><dd className="tabular-nums">{money(totals.grandTotal, currency)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/** Full-page create/edit form for quotations and invoices — both share the line-item shape. */
function DocumentForm({ kind, doc, onClose, onSaved }) {
  const customers = useFetch('/customers', { limit: 200, sort: 'name' });
  const users = useUsers();
  const currencies = useCurrencyCodes();
  const isInvoice = kind === 'invoice';
  const endpoint = isInvoice ? '/invoices' : '/quotations';

  const [head, setHead] = useState({
    subject: doc?.subject || '',
    customer: doc?.customer?._id || doc?.customer || '',
    assignedTo: doc?.assignedTo?._id || doc?.assignedTo || '',
    currency: doc?.currency || 'INR',
    [isInvoice ? 'invoiceDate' : 'quotationDate']: (doc?.[isInvoice ? 'invoiceDate' : 'quotationDate'] || new Date().toISOString()).slice(0, 10),
    [isInvoice ? 'dueDate' : 'validUntil']: (doc?.[isInvoice ? 'dueDate' : 'validUntil'] || '').slice(0, 10),
    termsAndConditions: doc?.termsAndConditions || '',
    notes: doc?.notes || '',
  });
  const selectedCustomer = (customers.data || []).find((c) => String(c._id) === String(head.customer));
  const [items, setItems] = useState(doc?.items?.map((i) => ({ ...i })) || []);
  const [extra, setExtra] = useState({
    additionalDiscount: doc?.additionalDiscount || 0,
    shippingCharges: doc?.shippingCharges || 0,
    adjustment: doc?.adjustment || 0,
  });
  const { run, pending, error } = useMutation();

  const submit = async (e) => {
    e.preventDefault();
    // An untouched customer / owner / date picker holds ''. Omitting it on create
    // lets the server defaults apply (the owner falls back to the current user);
    // on an edit it means the user cleared the field, so send an explicit null.
    const isEdit = !!doc?._id;
    const head2 = {};
    for (const [key, value] of Object.entries(head)) {
      if (value !== '') head2[key] = value;
      else if (isEdit && doc?.[key]) head2[key] = null;
    }
    const payload = { ...head2, ...extra, items: items.map(({ _id, ...i }) => i) };
    try {
      const res = isEdit
        ? await run((a) => a.put(`${endpoint}/${doc._id}`, payload))
        : await run((a) => a.post(endpoint, payload));
      onSaved(res.data);
    } catch {
      // `run` has already put the message on screen; keep the modal open.
    }
  };

  return (
    <Modal
      open onClose={onClose} width="max-w-5xl"
      title={doc?._id ? `Edit ${kind}` : `New ${kind}`}
      footer={<>
        <button className="btn-ghost" onClick={onClose} disabled={pending}>Cancel</button>
        <button className="btn-primary" form="doc-form" type="submit" disabled={pending}>{pending ? <Spinner className="h-4 w-4" /> : 'Save'}</button>
      </>}
    >
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <form id="doc-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Subject" required className="lg:col-span-2">
            <input className="input" required value={head.subject} onChange={(e) => setHead({ ...head, subject: e.target.value })} />
          </Field>
          <Field label="Customer" required={isInvoice} hint={selectedCustomer
            ? [selectedCustomer.customerNumber, nameOf(selectedCustomer.company), selectedCustomer.email]
              .filter((v) => v && v !== '—').join(' · ')
            : 'Search by account number, name, company or email.'}>
            <Select
              // Two accounts can share a name, so the number identifies which is
              // which and the company says who they belong to.
              options={(customers.data || []).map((c) => {
                const company = nameOf(c.company);
                return {
                  value: c._id,
                  label: `${c.customerNumber ? `${c.customerNumber} — ` : ''}${c.name}`,
                  // Skip the company when it just repeats the account name.
                  hint: [company !== '—' && company !== c.name ? company : null, c.email]
                    .filter(Boolean).join(' · '),
                };
              })}
              required={isInvoice}
              searchable
              value={head.customer}
              onChange={(e) => setHead({ ...head, customer: e.target.value })}
            />
          </Field>
          <Field label={isInvoice ? 'Invoice date' : 'Quotation date'}>
            <DatePicker value={head[isInvoice ? 'invoiceDate' : 'quotationDate']}
              onChange={(e) => setHead({ ...head, [isInvoice ? 'invoiceDate' : 'quotationDate']: e.target.value })} />
          </Field>
          <Field label={isInvoice ? 'Due date' : 'Valid until'}>
            <DatePicker value={head[isInvoice ? 'dueDate' : 'validUntil']} min={head[isInvoice ? 'invoiceDate' : 'quotationDate']}
              onChange={(e) => setHead({ ...head, [isInvoice ? 'dueDate' : 'validUntil']: e.target.value })} />
          </Field>
          <Field label="Owner">
            <UserSelect users={users} value={head.assignedTo}
              onChange={(e) => setHead({ ...head, assignedTo: e.target.value })} placeholder="Me" />
          </Field>
          <Field label="Currency">
            <Select options={currencies} value={head.currency} placeholder={null}
              onChange={(e) => setHead({ ...head, currency: e.target.value })} />
          </Field>
        </div>

        <LineItemEditor items={items} onChange={setItems} extra={extra} onExtraChange={setExtra} currency={head.currency} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Terms and conditions">
            <textarea className="input" rows={3} value={head.termsAndConditions} onChange={(e) => setHead({ ...head, termsAndConditions: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className="input" rows={3} value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Quotations

export function QuotationList() {
  const list = useList('/quotations');
  const statuses = useMasterNames('quotation-status', QUOTATION_STATUS);
  const { can } = useAuth();
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  return (
    <>
      <PageHeader title="Quotations" subtitle="Proposals from draft through approval to conversion."
        actions={can(GROUPS.SALES) && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New quotation</button>} />
      <DataTable
        list={list} title="quotations" exportName="quotations" rowLink={(r) => `/quotations/${r._id}`}
        emptyTitle="No quotations yet"
        filters={[
          { key: 'status', label: 'All statuses', options: statuses },
          { key: 'assignedTo', label: 'All owners', type: 'user' },
        ]}
        columns={[
          { key: 'quotationNumber', label: 'Number', sortable: true },
          { key: 'subject', label: 'Subject', sortable: true },
          { key: 'customer', label: 'Customer', render: (r) => nameOf(r.customer) || nameOf(r.lead), exportValue: (r) => nameOf(r.customer) },
          { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
          { key: 'grandTotal', label: 'Total', sortable: true, className: 'text-right', render: (r) => <span className="tabular-nums font-medium">{money(r.grandTotal, r.currency)}</span> },
          { key: 'quotationDate', label: 'Date', sortable: true, render: (r) => date(r.quotationDate) },
          { key: 'validUntil', label: 'Valid until', render: (r) => date(r.validUntil) },
        ]}
      />
      {form && <DocumentForm kind="quotation" doc={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); list.refresh(); setToast('Quotation saved'); }} />}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

export function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: quote, loading, error, refresh } = useFetch(`/quotations/${id}`);
  const [edit, setEdit] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [converting, setConverting] = useState(null);
  const [toast, setToast] = useState('');
  const { run, pending } = useMutation();

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const act = async (fn, message) => {
    try { await run(fn); setToast(message); refresh(); }
    catch (err) { setToast(errorToast(err)); }
  };

  const canSell = can(GROUPS.SALES);
  const canApprove = can([...GROUPS.MANAGEMENT, 'Finance']);

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/quotations" className="hover:underline">Quotations</Link>}
        title={quote.quotationNumber}
        subtitle={quote.subject}
        actions={
          <>
            <button className="btn-ghost btn-sm no-print" onClick={() => downloadPdf(`/quotations/${id}/pdf`, `${quote.quotationNumber}.pdf`, setToast)}>
              Download PDF
            </button>
            {canSell && quote.status === 'Draft' && <button className="btn-ghost btn-sm" onClick={() => act((a) => a.post(`/quotations/${id}/submit`), 'Submitted for approval')} disabled={pending}>Submit</button>}
            {canApprove && ['Pending Approval', 'Draft'].includes(quote.status) && (
              <>
                <button className="btn-ghost btn-sm" onClick={() => act((a) => a.post(`/quotations/${id}/approve`, { approved: false, reason: 'Rejected from detail view' }), 'Rejected')} disabled={pending}>Reject</button>
                <button className="btn-primary btn-sm" onClick={() => act((a) => a.post(`/quotations/${id}/approve`, { approved: true }), 'Approved')} disabled={pending}>Approve</button>
              </>
            )}
            {canSell && ['Approved', 'Sent', 'Accepted'].includes(quote.status) && <button className="btn-ghost btn-sm" onClick={() => setEmailing(true)}>Email</button>}
            {canSell && ['Approved', 'Sent', 'Accepted'].includes(quote.status) && !quote.convertedToOrder && (
              <button className="btn-primary btn-sm" onClick={() => setConverting('order')}>Create sales order</button>
            )}
            {canSell && quote.status !== 'Converted' && !quote.convertedToInvoice && quote.customer && (
              <button className="btn-ghost btn-sm" onClick={() => setConverting('invoice')}>Invoice directly</button>
            )}
            {canSell && ['Draft', 'Pending Approval'].includes(quote.status) && <button className="btn-ghost btn-sm" onClick={() => setEdit(true)}>Edit</button>}
          </>
        }
      />
      {/* Once converted the action buttons disappear; without this the trail
          from quotation to order or invoice was invisible. */}
      {(quote.convertedToOrder || quote.convertedToInvoice) && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 no-print">
          Converted to{' '}
          {quote.convertedToOrder && <Link className="font-medium underline" to="/orders">a sales order</Link>}
          {quote.convertedToOrder && quote.convertedToInvoice && ' and '}
          {quote.convertedToInvoice && (
            <Link className="font-medium underline" to={`/invoices/${quote.convertedToInvoice._id || quote.convertedToInvoice}`}>
              an invoice
            </Link>
          )}.
        </p>
      )}

      <DocumentView doc={quote} kind="quotation" />

      <div className="mt-5 no-print">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Files</h3>
        <AttachmentsPanel entityType="Quotation" entityId={id} readOnly={!canSell} />
      </div>

      <div className="mt-5 no-print">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Tracking</h3>
        <TrackingPanel entityType="Quotation" entityId={id} />
      </div>

      {edit && <DocumentForm kind="quotation" doc={quote} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); refresh(); setToast('Quotation updated'); }} />}
      <EmailModal open={emailing} onClose={() => setEmailing(false)} endpoint={`/quotations/${id}/email`}
        defaultTo={quote.customer?.email || quote.lead?.email} onDone={() => { refresh(); setToast('Quotation emailed'); }} />
      <ConfirmDialog
        open={!!converting} onClose={() => setConverting(null)}
        title={converting === 'order' ? 'Create sales order?' : 'Create invoice?'}
        message={converting === 'order'
          ? 'A sales order is created from this quotation with the same line items. The quotation is then marked Converted.'
          : 'An invoice is raised directly from this quotation using the customer’s payment terms.'}
        confirmLabel="Create"
        onConfirm={async () => {
          try {
            const res = await api.post(`/quotations/${id}/convert-to-${converting}`, {});
            navigate(converting === 'order' ? '/orders' : `/invoices/${res.data._id}`);
          } catch (err) {
            // Without this a refused conversion left the dialog sitting open
            // with no explanation.
            setToast(errorToast(err));
            setConverting(null);
            refresh();
          }
        }}
      />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

/** Printable document body shared by quotations and invoices. */
function DocumentView({ doc, kind }) {
  const isInvoice = kind === 'invoice';
  return (
    <div className="card-pad">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{isInvoice ? 'Invoice' : 'Quotation'} {doc.invoiceNumber || doc.quotationNumber}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{doc.subject}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge>{doc.status}</Badge>
            {doc.approvedAt && <span className="text-xs text-slate-500">Approved {date(doc.approvedAt)}</span>}
          </div>
        </div>
        <dl className="text-sm">
          <div className="flex gap-3"><dt className="text-slate-500">Date</dt><dd className="font-medium">{date(doc.invoiceDate || doc.quotationDate)}</dd></div>
          <div className="flex gap-3"><dt className="text-slate-500">{isInvoice ? 'Due' : 'Valid until'}</dt><dd className="font-medium">{date(doc.dueDate || doc.validUntil)}</dd></div>
          <div className="flex gap-3"><dt className="text-slate-500">Owner</dt><dd className="font-medium">{nameOf(doc.assignedTo)}</dd></div>
        </dl>
      </div>

      <div className="mb-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Bill to</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{nameOf(doc.customer) || nameOf(doc.lead)}</p>
          <p className="text-sm text-slate-600">{doc.customer?.email || doc.lead?.email}</p>
          <p className="text-sm text-slate-600">
            {[doc.billingAddress?.line1 || doc.customer?.billingAddress?.line1,
              doc.billingAddress?.city || doc.customer?.billingAddress?.city].filter(Boolean).join(', ')}
          </p>
        </div>
        {isInvoice && (
          <div className="sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Balance due</p>
            <p className={`mt-1 text-2xl font-semibold ${doc.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {money(doc.balanceDue, doc.currency)}
            </p>
            <p className="text-sm text-slate-500">{money(doc.amountPaid, doc.currency)} paid of {money(doc.grandTotal, doc.currency)}</p>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">#</th><th className="th">Item</th>
              <th className="th text-right">Qty</th><th className="th text-right">Rate</th>
              <th className="th text-right">Disc</th><th className="th text-right">Tax</th><th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items?.map((item, i) => (
              <tr key={item._id || i} className="border-t border-slate-100">
                <td className="td text-slate-400">{i + 1}</td>
                <td className="td"><span className="font-medium text-slate-800">{item.name}</span>{item.description && <span className="block text-xs text-slate-500">{item.description}</span>}</td>
                <td className="td text-right tabular-nums">{item.quantity} {item.unit}</td>
                <td className="td text-right tabular-nums">{money(item.unitPrice, doc.currency)}</td>
                <td className="td text-right tabular-nums">{item.discountPercent || 0}%</td>
                <td className="td text-right tabular-nums">{item.taxPercent || 0}%</td>
                <td className="td text-right font-medium tabular-nums">{money(item.lineTotal, doc.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{money(doc.subtotal, doc.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums text-rose-600">−{money(doc.discountAmount, doc.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="tabular-nums">{money(doc.taxAmount, doc.currency)}</dd></div>
          {!!doc.shippingCharges && <div className="flex justify-between"><dt className="text-slate-500">Shipping</dt><dd className="tabular-nums">{money(doc.shippingCharges, doc.currency)}</dd></div>}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
            <dt>Total</dt><dd className="tabular-nums">{money(doc.grandTotal, doc.currency)}</dd>
          </div>
        </dl>
      </div>

      {(doc.termsAndConditions || doc.notes) && (
        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {doc.termsAndConditions && <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Terms</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{doc.termsAndConditions}</p></div>}
          {doc.notes && <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{doc.notes}</p></div>}
        </div>
      )}
    </div>
  );
}

function EmailModal({ open, onClose, endpoint, defaultTo, onDone }) {
  const [to, setTo] = useState(defaultTo || '');
  const [message, setMessage] = useState('');
  const { run, pending, error } = useMutation();
  useEffect(() => { setTo(defaultTo || ''); }, [defaultTo, open]);

  return (
    <Modal open={open} onClose={onClose} title="Send email" width="max-w-lg"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          await run((a) => a.post(endpoint, { to, message })); onDone(); onClose();
        }}>Send</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        {/* This used to claim SMTP was unconfigured whatever the truth, which
            read as the explanation for any send that failed. */}
        <Field label="To" hint="The document is attached as a PDF."><input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Message (optional)"><textarea className="input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Sales orders

export function SalesOrders() {
  const list = useList('/orders');
  const orderStatuses = useMasterNames('order-status', ORDER_STATUS);
  const deliveryStatuses = useMasterNames('delivery-status', DELIVERY_STATUS);
  const { can } = useAuth();
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  const action = async (fn, message) => {
    try { await fn(); setToast(message); list.refresh(); setDetail(null); }
    catch (err) { setToast(errorToast(err)); }
  };

  return (
    <>
      <PageHeader title="Sales orders" subtitle="Confirmed orders, their delivery and payment state." />
      <DataTable
        list={list} title="orders" exportName="sales-orders" onRowClick={setDetail}
        emptyTitle="No sales orders" emptyHint="Convert an approved quotation to create one."
        filters={[
          { key: 'status', label: 'All statuses', options: orderStatuses },
          { key: 'deliveryStatus', label: 'All deliveries', options: deliveryStatuses },
          { key: 'paymentStatus', label: 'All payments', options: ['Unpaid', 'Partially Paid', 'Paid'] },
        ]}
        columns={[
          { key: 'orderNumber', label: 'Order', sortable: true },
          { key: 'subject', label: 'Subject' },
          { key: 'customer', label: 'Customer', render: (r) => nameOf(r.customer), exportValue: (r) => nameOf(r.customer) },
          { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
          { key: 'deliveryStatus', label: 'Delivery', render: (r) => <Badge>{r.deliveryStatus}</Badge> },
          { key: 'paymentStatus', label: 'Payment', render: (r) => <Badge>{r.paymentStatus}</Badge> },
          { key: 'grandTotal', label: 'Total', sortable: true, className: 'text-right', render: (r) => <span className="tabular-nums font-medium">{money(r.grandTotal, r.currency)}</span> },
          { key: 'invoices', label: 'Invoiced', render: (r) => (r.invoices?.length
            ? <Badge tone="bg-emerald-100 text-emerald-700">Yes</Badge>
            : <span className="text-xs text-slate-400">Not yet</span>),
            exportValue: (r) => (r.invoices?.length ? 'Yes' : 'No') },
          { key: 'orderDate', label: 'Date', sortable: true, render: (r) => date(r.orderDate) },
        ]}
      />

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`${detail.orderNumber} — ${detail.subject}`} width="max-w-3xl"
          footer={<>
            <button className="btn-ghost" onClick={() => setDetail(null)}>Close</button>
            <button className="btn-ghost" onClick={() => downloadPdf(`/orders/${detail._id}/pdf`, `${detail.orderNumber}.pdf`, setToast)}>
              Download PDF
            </button>
            {can([...GROUPS.MANAGEMENT, 'Finance']) && detail.status === 'Draft' && (
              <button className="btn-ghost" onClick={() => action(() => api.post(`/orders/${detail._id}/approve`, {}), 'Order approved')}>Approve</button>
            )}
            {can(GROUPS.SALES) && detail.deliveryStatus !== 'Delivered' && (
              <Select className="w-44" placeholder="Set delivery status" options={deliveryStatuses}
                value="" onChange={(e) => e.target.value && action(() => api.patch(`/orders/${detail._id}/delivery`, { deliveryStatus: e.target.value }), `Delivery set to ${e.target.value}`)} />
            )}
            {detail.status !== 'Draft' && !detail.invoices?.length && (
              <button className="btn-primary" onClick={async () => {
                try {
                  const res = await api.post(`/orders/${detail._id}/convert-to-invoice`, {});
                  navigate(`/invoices/${res.data._id}`);
                } catch (err) {
                  setToast(errorToast(err));
                  list.refresh();
                  setDetail(null);
                }
              }}>Create invoice</button>
            )}
            {!!detail.invoices?.length && (
              <button className="btn-primary" onClick={() => navigate(`/invoices/${detail.invoices[0]._id || detail.invoices[0]}`)}>
                View invoice
              </button>
            )}
          </>}>
          <DocumentView doc={detail} kind="order" />
        </Modal>
      )}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

// ---------------------------------------------------------------- Invoices

export function InvoiceList() {
  const [tab, setTab] = useState('all');
  const list = useList('/invoices');
  const invoiceStatuses = useMasterNames('invoice-status', INVOICE_STATUS);
  const outstanding = useFetch('/invoices/outstanding');
  const { can } = useAuth();
  const [form, setForm] = useState(null);
  const [toast, setToast] = useState('');

  return (
    <>
      <PageHeader title="Invoices" subtitle="Billing, collections and credit notes."
        actions={can(GROUPS.FINANCE) && <button className="btn-primary btn-sm" onClick={() => setForm({})}>New invoice</button>} />

      <Tabs active={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All invoices' }, { key: 'outstanding', label: 'Outstanding' }]} />

      {tab === 'all' && (
        <DataTable
          list={list} title="invoices" exportName="invoices" rowLink={(r) => `/invoices/${r._id}`}
          emptyTitle="No invoices yet"
          filters={[
            { key: 'status', label: 'All statuses', options: invoiceStatuses },
            { key: 'assignedTo', label: 'All owners', type: 'user' },
          ]}
          columns={[
            { key: 'invoiceNumber', label: 'Invoice', sortable: true },
            { key: 'subject', label: 'Subject' },
            { key: 'customer', label: 'Customer', render: (r) => nameOf(r.customer), exportValue: (r) => nameOf(r.customer) },
            { key: 'status', label: 'Status', sortable: true, render: (r) => <Badge>{r.status}</Badge> },
            { key: 'grandTotal', label: 'Total', sortable: true, className: 'text-right', render: (r) => <span className="tabular-nums">{money(r.grandTotal, r.currency)}</span> },
            { key: 'balanceDue', label: 'Balance', sortable: true, className: 'text-right', render: (r) => (
              <span className={`tabular-nums ${r.balanceDue > 0 ? 'font-medium text-rose-600' : 'text-emerald-600'}`}>{money(r.balanceDue, r.currency)}</span>
            ) },
            { key: 'invoiceDate', label: 'Date', sortable: true, render: (r) => date(r.invoiceDate) },
            { key: 'dueDate', label: 'Due', sortable: true, render: (r) => date(r.dueDate) },
          ]}
        />
      )}

      {tab === 'outstanding' && (
        outstanding.loading ? <Loading /> : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-6">
              <div className="card-pad">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total due</p>
                <p className="mt-1.5 text-lg font-semibold text-rose-600">{money(outstanding.data?.totalOutstanding || 0)}</p>
              </div>
              {['Current', '1-30', '31-60', '61-90', '90+'].map((bucket) => (
                <div key={bucket} className="card-pad">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{bucket === 'Current' ? 'Not due' : `${bucket} days`}</p>
                  <p className="mt-1.5 text-lg font-semibold text-slate-900">{money(outstanding.data?.summary?.[bucket] || 0, 'INR', { compact: true })}</p>
                </div>
              ))}
            </div>
            <SimpleTable
              rows={outstanding.data?.invoices || []} empty="Nothing outstanding — everything is collected."
              columns={[
                ['Invoice', (i) => <Link className="font-medium text-brand-700 hover:underline" to={`/invoices/${i._id}`}>{i.invoiceNumber}</Link>],
                ['Customer', (i) => nameOf(i.customer)],
                ['Total', (i) => money(i.grandTotal, i.currency)],
                ['Balance', (i) => <span className="font-medium text-rose-600">{money(i.balanceDue, i.currency)}</span>],
                ['Due', (i) => date(i.dueDate)],
                ['Overdue', (i) => (i.overdueDays > 0 ? `${i.overdueDays} days` : '—')],
                ['Ageing', (i) => <Badge tone="bg-slate-100 text-slate-700">{i.ageingBucket}</Badge>],
              ]}
            />
          </>
        )
      )}

      {form && <DocumentForm kind="invoice" doc={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); list.refresh(); setToast('Invoice created'); }} />}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

export function InvoiceDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, error, refresh } = useFetch(`/invoices/${id}/print`);
  const [paying, setPaying] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [toast, setToast] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const { invoice, payments } = data;
  const canFinance = can(GROUPS.FINANCE);

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/invoices" className="hover:underline">Invoices</Link>}
        title={invoice.invoiceNumber}
        subtitle={invoice.subject}
        actions={
          <>
            <button className="btn-ghost btn-sm no-print" onClick={() => downloadPdf(`/invoices/${id}/pdf`, `${invoice.invoiceNumber}.pdf`, setToast)}>
              Download PDF
            </button>
            {canFinance && <button className="btn-ghost btn-sm" onClick={() => setEmailing(true)}>Email</button>}
            {canFinance && invoice.balanceDue > 0 && <button className="btn-primary btn-sm" onClick={() => setPaying(true)}>Record payment</button>}
            {canFinance && !invoice.creditNote?.number && <button className="btn-ghost btn-sm" onClick={() => setCrediting(true)}>Credit note</button>}
          </>
        }
      />

      {invoice.creditNote?.number && (
        <p className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
          Credit note {invoice.creditNote.number} for {money(invoice.creditNote.amount, invoice.currency)} issued on {date(invoice.creditNote.issuedAt)}
          {invoice.creditNote.reason ? ` — ${invoice.creditNote.reason}` : ''}.
        </p>
      )}

      <DocumentView doc={invoice} kind="invoice" />

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Payments received</h3>
        <SimpleTable rows={payments} empty="No payments recorded yet"
          columns={[
            ['Payment', (p) => p.paymentNumber],
            ['Mode', (p) => p.mode],
            ['Amount', (p) => <span className={p.isRefund ? 'text-rose-600' : 'font-medium'}>{p.isRefund ? '−' : ''}{money(p.amount, p.currency)}</span>],
            ['Reference', (p) => p.referenceNumber || p.transactionId || '—'],
            ['Date', (p) => date(p.paidAt)],
            ['Status', (p) => <Badge>{p.status}</Badge>],
          ]} />
      </div>

      <div className="mt-5 no-print">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Files</h3>
        <AttachmentsPanel entityType="Invoice" entityId={id} readOnly={!canFinance} />
      </div>

      <div className="mt-5 no-print">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Tracking</h3>
        <TrackingPanel entityType="Invoice" entityId={id} />
      </div>

      <PaymentModal open={paying} onClose={() => setPaying(false)} invoice={invoice} onDone={() => { refresh(); setToast('Payment recorded'); }} />
      <CreditNoteModal open={crediting} onClose={() => setCrediting(false)} invoice={invoice} onDone={() => { refresh(); setToast('Credit note issued'); }} />
      <EmailModal open={emailing} onClose={() => setEmailing(false)} endpoint={`/invoices/${id}/email`}
        defaultTo={invoice.customer?.email} onDone={() => { refresh(); setToast('Invoice emailed'); }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function PaymentModal({ open, onClose, invoice, onDone }) {
  const modes = useMasterNames('payment-mode', PAYMENT_MODES);
  const [form, setForm] = useState({ amount: 0, mode: 'Bank Transfer', referenceNumber: '', paidAt: new Date().toISOString().slice(0, 10), notes: '' });
  const { run, pending, error } = useMutation();

  useEffect(() => { if (open) setForm((f) => ({ ...f, amount: invoice?.balanceDue || 0 })); }, [open, invoice]);

  return (
    <Modal open={open} onClose={onClose} title="Record payment"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          await run((a) => a.post('/payments/record', { ...form, invoice: invoice._id, customer: invoice.customer?._id || invoice.customer }));
          onDone(); onClose();
        }}>{pending ? <Spinner className="h-4 w-4" /> : 'Record payment'}</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <p className="mb-4 text-sm text-slate-600">Balance due on {invoice.invoiceNumber}: <span className="font-semibold text-slate-900">{money(invoice.balanceDue, invoice.currency)}</span></p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" required><input className="input" type="number" min="0.01" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.valueAsNumber || 0 })} /></Field>
        <Field label="Mode"><Select options={modes} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} placeholder={null} /></Field>
        <Field label="Reference / transaction id"><input className="input" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} /></Field>
        <Field label="Received on"><DatePicker value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} /></Field>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CreditNoteModal({ open, onClose, invoice, onDone }) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const { run, pending, error } = useMutation();
  useEffect(() => { if (open) setAmount(invoice?.balanceDue || 0); }, [open, invoice]);

  return (
    <Modal open={open} onClose={onClose} title="Issue credit note" width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={pending} onClick={async () => {
          await run((a) => a.post(`/invoices/${invoice._id}/credit-note`, { amount, reason })); onDone(); onClose();
        }}>Issue</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <Field label="Amount" hint={`Cannot exceed the invoice total of ${money(invoice.grandTotal, invoice.currency)}.`}>
          <input className="input" type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.valueAsNumber || 0)} />
        </Field>
        <Field label="Reason"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Payments

export function Payments() {
  const list = useList('/payments');
  const modes = useMasterNames('payment-mode', PAYMENT_MODES);
  const paymentStatuses = useMasterNames('payment-status', ['Pending', 'Completed', 'Failed', 'Refunded']);
  const { can } = useAuth();
  const [refundFor, setRefundFor] = useState(null);
  const [toast, setToast] = useState('');
  const canFinance = can(GROUPS.FINANCE);

  return (
    <>
      <PageHeader title="Payments" subtitle="Money received, and refunds issued against it." />
      <DataTable
        list={list} title="payments" exportName="payments"
        emptyTitle="No payments recorded"
        filters={[
          { key: 'mode', label: 'All modes', options: modes },
          { key: 'status', label: 'All statuses', options: paymentStatuses },
        ]}
        columns={[
          { key: 'paymentNumber', label: 'Payment', sortable: true },
          { key: 'customer', label: 'Customer', render: (r) => nameOf(r.customer), exportValue: (r) => nameOf(r.customer) },
          { key: 'invoice', label: 'Invoice', render: (r) => (r.invoice
            ? <Link className="text-brand-700 hover:underline" to={`/invoices/${r.invoice._id}`}>{r.invoice.invoiceNumber}</Link>
            : '—'), exportValue: (r) => r.invoice?.invoiceNumber || '' },
          { key: 'mode', label: 'Mode', sortable: true },
          { key: 'amount', label: 'Amount', sortable: true, className: 'text-right', render: (r) => (
            <span className={`tabular-nums font-medium ${r.isRefund ? 'text-rose-600' : 'text-slate-800'}`}>{r.isRefund ? '−' : ''}{money(r.amount, r.currency)}</span>
          ) },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'paidAt', label: 'Date', sortable: true, render: (r) => date(r.paidAt) },
          { key: 'actions', label: '', render: (r) => canFinance && !r.isRefund && r.status === 'Completed'
            ? <button className="btn-ghost btn-sm" onClick={() => setRefundFor(r)}>Refund</button> : null },
        ]}
      />
      <RefundModal payment={refundFor} onClose={() => setRefundFor(null)} onDone={() => { list.refresh(); setToast('Refund recorded'); }} />
      <Toast message={toast} onDismiss={() => setToast('')} />
    </>
  );
}

function RefundModal({ payment, onClose, onDone }) {
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const { run, pending, error } = useMutation();
  useEffect(() => { setAmount(payment?.amount || 0); setReason(''); }, [payment]);
  if (!payment) return null;

  return (
    <Modal open onClose={onClose} title={`Refund ${payment.paymentNumber}`} width="max-w-md"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-danger" disabled={pending} onClick={async () => {
          await run((a) => a.post(`/payments/${payment._id}/refund`, { amount, reason })); onDone(); onClose();
        }}>Issue refund</button></>}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-4">
        <Field label="Refund amount" hint={`Original payment: ${money(payment.amount, payment.currency)}`}>
          <input className="input" type="number" min="0.01" max={payment.amount} step="any" value={amount} onChange={(e) => setAmount(e.target.valueAsNumber || 0)} />
        </Field>
        <Field label="Reason"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
