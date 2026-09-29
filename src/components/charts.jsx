import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, Cell,
} from 'recharts';
import { money, number } from '../lib/format.js';

/**
 * Chart tokens. Categorical slots come from a validated order (blue → orange);
 * charts here never exceed two categorical series, so the pair stays well clear
 * of the CVD and normal-vision floors. Magnitude uses the single-hue blue ramp.
 */
export const VIZ = {
  series1: '#2a78d6',   // blue  — slot 1
  series2: '#eb6834',   // orange — slot 2
  good: '#0ca30c',
  critical: '#d03b3b',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  muted: '#898781',
  ink: '#0b0b0b',
  inkSoft: '#52514e',
  surface: '#ffffff',
};

/** Ordinal blue ramp — the step nearest the surface still clears 2:1 on white. */
export const BLUE_RAMP = ['#86b6ef', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];

export const rampAt = (index, total) =>
  BLUE_RAMP[Math.min(BLUE_RAMP.length - 1, Math.round((index / Math.max(1, total - 1)) * (BLUE_RAMP.length - 1)))];

const axisProps = {
  stroke: VIZ.axis,
  tick: { fill: VIZ.muted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: VIZ.axis },
};

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      {label != null && <p className="mb-1 text-xs font-semibold text-slate-800">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-xs text-slate-600">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color || entry.payload?.fill }} />
          <span>{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-slate-900">
            {formatter ? formatter(entry.value, entry.dataKey) : number(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, children, action, height = 260, footer }) {
  return (
    <section className="card-pad">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div style={{ height }}>{children}</div>
      {footer && <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{footer}</div>}
    </section>
  );
}

/** Single-series area — revenue and customer growth over time. */
export function TrendArea({ data, xKey, yKey, label, currency, color = VIZ.series1 }) {
  const fmt = currency ? (v) => money(v, currency, { compact: true }) : (v) => number(v, true);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={VIZ.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={54} tickFormatter={fmt} />
        <Tooltip
          content={<ChartTooltip formatter={(v) => (currency ? money(v, currency) : number(v))} />}
          cursor={{ stroke: VIZ.axis, strokeWidth: 1 }}
        />
        <Area
          type="monotone" dataKey={yKey} name={label} stroke={color} strokeWidth={2}
          fill={`url(#fill-${yKey})`} dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: VIZ.surface }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Two-series grouped columns — always legended, since colour alone can't carry identity. */
export function GroupedBars({ data, xKey, series, currency }) {
  const fmt = currency ? (v) => money(v, currency, { compact: true }) : (v) => number(v, true);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={VIZ.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={46} tickFormatter={fmt} />
        <Tooltip content={<ChartTooltip formatter={(v) => (currency ? money(v, currency) : number(v))} />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: VIZ.inkSoft, paddingTop: 8 }} />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={i === 0 ? VIZ.series1 : VIZ.series2} radius={[4, 4, 0, 0]} maxBarSize={26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Horizontal ranking bars with a value label on each bar.
 * `ordinal` shades the bars along the blue ramp when the categories are ordered
 * (funnel stages, pipeline stages) rather than merely ranked.
 */
export function RankedBars({ data, categoryKey, valueKey, currency, ordinal = false, height }) {
  const fmt = (v) => (currency ? money(v, currency, { compact: true }) : number(v));
  return (
    <ResponsiveContainer width="100%" height={height || '100%'}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
        <CartesianGrid stroke={VIZ.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={fmt} />
        <YAxis type="category" dataKey={categoryKey} {...axisProps} width={110} />
        <Tooltip content={<ChartTooltip formatter={(v) => (currency ? money(v, currency) : number(v))} />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
        <Bar dataKey={valueKey} name={valueKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((row, i) => (
            <Cell key={row[categoryKey] ?? i} fill={ordinal ? rampAt(i, data.length) : VIZ.series1} />
          ))}
          <LabelList dataKey={valueKey} position="right" formatter={fmt} style={{ fill: VIZ.inkSoft, fontSize: 11, fontWeight: 500 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single or dual line series — used for forecast comparisons. */
export function TrendLines({ data, xKey, series, currency }) {
  const fmt = currency ? (v) => money(v, currency, { compact: true }) : (v) => number(v, true);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={VIZ.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} width={54} tickFormatter={fmt} />
        <Tooltip content={<ChartTooltip formatter={(v) => (currency ? money(v, currency) : number(v))} />} cursor={{ stroke: VIZ.axis, strokeWidth: 1 }} />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: VIZ.inkSoft, paddingTop: 8 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key} type="monotone" dataKey={s.key} name={s.label}
            stroke={i === 0 ? VIZ.series1 : VIZ.series2} strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 2, stroke: VIZ.surface }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Stage breakdown rendered as proportional rows rather than a tapered polygon.
 * Bars are scaled against the largest stage — these are the counts currently
 * sitting at each stage, not survivors of a cumulative funnel, so no
 * stage-to-stage drop percentage is shown (it would misread as attrition).
 */
export function Funnel({ data, labelKey = 'stage', valueKey = 'count', secondaryKey, currency }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey] || 0));
  return (
    <ul className="space-y-2.5">
      {data.map((row, i) => {
        const value = row[valueKey] || 0;
        const width = Math.max(2, (value / max) * 100);
        return (
          <li key={row[labelKey]}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-700">{row[labelKey]}</span>
              <span className="flex items-center gap-2">
                {secondaryKey != null && (
                  <span className="text-slate-400">{money(row[secondaryKey] || 0, currency || 'INR', { compact: true })}</span>
                )}
                <span className="font-semibold tabular-nums text-slate-900">{number(value)}</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: rampAt(i, data.length) }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Stat tile: a headline number needs no plot. `delta` renders with an icon, never colour alone. */
export function StatTile({ label, value, sub, delta, tone, icon }) {
  const up = delta != null && delta >= 0;
  return (
    <div className="card-pad">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon && <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone || 'bg-brand-50 text-brand-600'}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta != null && (
          <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: up ? '#006300' : VIZ.critical }}>
            <span aria-hidden="true">{up ? '▲' : '▼'}</span>
            {Math.abs(delta).toFixed(1)}%
            <span className="sr-only">{up ? 'increase' : 'decrease'}</span>
          </span>
        )}
        {sub && <span className="text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}
