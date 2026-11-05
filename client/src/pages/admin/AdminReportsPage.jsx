import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  IndianRupee,
  Leaf,
  Printer,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useApiQuery, useDocumentTitle } from "../../hooks/useApiQuery.js";
import { apiBlob } from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";
import { money } from "../../lib/format.js";
import { Button, Skeleton, VegMark } from "../../components/ui.jsx";

function isoDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(count) {
  const d = new Date();
  d.setDate(d.getDate() - count);
  return d;
}

function ReportBars({ data }) {
  const max = Math.max(1, ...data.map((day) => day.revenue));
  return (
    <div className="report-bars">
      <div className="report-bars__chart">
        {data.map((day, index) => {
          const height = Math.max(day.revenue ? 4 : 1, (day.revenue / max) * 100);
          return (
            <div className="report-bar-column" key={day.date}>
              <div className="report-bar-column__value" title={`${day.label}: ${money(day.revenue)}`}>
                {day.revenue > 0 ? <span>{money(day.revenue).replace("₹", "")}</span> : null}
              </div>
              <div className="report-bar-column__track">
                <span style={{ height: `${height}%` }} className={index === data.length - 1 ? "is-today" : ""} />
              </div>
              <span className="report-bar-column__label">{day.label}</span>
              <small>{day.orders} orders</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
];

export default function AdminReportsPage() {
  useDocumentTitle("Reports");
  const toast = useToast();
  const [from, setFrom] = useState(() => isoDate(daysAgo(6)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, refetch, refreshing } = useApiQuery(`/admin/reports?from=${from}&to=${to}`);
  const summary = data?.summary;

  const activePreset = useMemo(() => {
    const today = isoDate(new Date());
    if (to !== today) return null;
    const preset = PRESETS.find((item) => from === isoDate(daysAgo(item.days)) && to === today);
    return preset?.label || null;
  }, [from, to]);

  function applyPreset(days) {
    setFrom(isoDate(daysAgo(days)));
    setTo(isoDate(new Date()));
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await apiBlob(`/admin/reports/export?from=${from}&to=${to}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `smartdine-orders-${from}-to-${to}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV export downloaded.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__head"><Skeleton width={300} height={40} /></div>
        <div className="report-filters-skeleton"><Skeleton height={56} radius={14} /><Skeleton width={160} height={42} radius={10} /></div>
        <div className="menu-stats">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={100} radius={14} />)}</div>
        <Skeleton height={420} radius={18} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error-panel">
          <h2>Couldn't build this report</h2>
          <p>{error.message}</p>
          <Button variant="primary" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxMethod = Math.max(1, ...data.byMethod.map((method) => method.total));
  const maxCategory = Math.max(1, ...data.byCategory.map((category) => category.revenue));

  return (
    <div className="admin-page admin-reports-page">
      <header className="admin-page__head">
        <div>
          <span className="admin-page__eyebrow"><BarChart3 size={13} /> Analytics & exports</span>
          <h1>Know your service.</h1>
          <p>Revenue, guest favourites and payment behaviour for the period you choose.</p>
        </div>
        <div className="admin-page__actions">
          <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
          <Button variant="primary" size="sm" icon={ArrowDownToLine} onClick={exportCsv} loading={exporting}>Export CSV</Button>
        </div>
      </header>

      <div className="report-filters">
        <div className="report-presets">
          {PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.label}
              className={activePreset === preset.label ? "is-active" : ""}
              onClick={() => applyPreset(preset.days)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="report-date-range">
          <span><CalendarDays size={15} /> From</span>
          <input type="date" className="input" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
          <span>To</span>
          <input type="date" className="input" value={to} min={from} max={isoDate(new Date())} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => refetch()} loading={refreshing}>Refresh</Button>
      </div>

      <div className="report-range-label">
        <span>{data.range.days} day{data.range.days === 1 ? "" : "s"}</span>
        <p>{new Date(`${data.range.from}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" })} — {new Date(`${data.range.to}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
        <div className="report-range-label__live"><span className="live-dot" /> Auto-refresh on activity</div>
      </div>

      <div className="report-summary-grid">
        <article className="report-stat report-stat--primary">
          <span>Total revenue</span>
          <strong>{money(summary.revenue)}</strong>
          <small><TrendingUp size={13} /> {summary.paidOrders} paid orders</small>
        </article>
        <article className="report-stat">
          <span>Orders placed</span>
          <strong>{summary.orders}</strong>
          <small>{summary.cancelledOrders} cancelled</small>
        </article>
        <article className="report-stat">
          <span>Average order</span>
          <strong>{money(summary.averageOrder)}</strong>
          <small>Per paid order</small>
        </article>
        <article className="report-stat">
          <span>GST collected</span>
          <strong>{money(summary.tax)}</strong>
          <small>On non-cancelled orders</small>
        </article>
        <article className="report-stat">
          <span>Pending</span>
          <strong>{money(summary.pending)}</strong>
          <small><Clock3 size={13} /> Awaiting settlement</small>
        </article>
        <article className="report-stat">
          <span>Cancelled</span>
          <strong>{summary.cancelledOrders}</strong>
          <small><XCircle size={13} /> Across this range</small>
        </article>
      </div>

      <section className="admin-panel report-chart-panel">
        <div className="admin-panel__head">
          <div>
            <span className="admin-panel__eyebrow">Daily performance</span>
            <h2>Revenue by day</h2>
          </div>
          <div className="chart-legend"><span className="chart-legend__dot" /> Revenue</div>
        </div>
        <ReportBars data={data.byDay} />
      </section>

      <div className="report-grid">
        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Best sellers</span>
              <h2>Top dishes</h2>
            </div>
            <span className="admin-panel__meta">By quantity</span>
          </div>
          <div className="report-top-items">
            {data.topItems.length === 0 ? (
              <p className="report-empty">No item sales in this range.</p>
            ) : (
              data.topItems.map((item, index) => (
                <div className="report-top-item" key={item.name}>
                  <span className="report-top-item__rank">{String(index + 1).padStart(2, "0")}</span>
                  <VegMark isVeg={item.isVeg} size="sm" />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.qty} sold</span>
                  </div>
                  <strong>{money(item.revenue)}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Payment mix</span>
              <h2>How guests paid</h2>
            </div>
            <WalletCards size={18} className="panel__icon" />
          </div>
          {data.byMethod.length === 0 ? (
            <p className="report-empty">No payments in this range.</p>
          ) : (
            <div className="report-method-list">
              {data.byMethod.map((item) => (
                <div className="report-method" key={item.method}>
                  <div className="report-method__top">
                    <strong>{item.method}</strong>
                    <span>{item.count} payments</span>
                    <strong>{money(item.total)}</strong>
                  </div>
                  <div className="report-method__bar"><span style={{ width: `${(item.total / maxMethod) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <div className="report-method__total">
            <span>Total collected</span>
            <strong>{money(data.byMethod.reduce((sum, item) => sum + item.total, 0))}</strong>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Category performance</span>
              <h2>Revenue by section</h2>
            </div>
            <Leaf size={18} className="panel__icon" />
          </div>
          {data.byCategory.length === 0 ? (
            <p className="report-empty">No category sales in this range.</p>
          ) : (
            <div className="report-category-list">
              {data.byCategory.map((item, index) => (
                <div className="report-category" key={item.name}>
                  <div className="report-category__top">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{item.name}</strong>
                    <span>{item.qty} sold</span>
                    <strong>{money(item.revenue)}</strong>
                  </div>
                  <div className="report-category__bar"><span style={{ width: `${(item.revenue / maxCategory) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Order health</span>
              <h2>Status breakdown</h2>
            </div>
            <ReceiptText size={18} className="panel__icon" />
          </div>
          <div className="status-breakdown">
            {Object.entries(data.statusSplit).map(([status, count]) => {
              const total = Object.values(data.statusSplit).reduce((sum, value) => sum + value, 0);
              return (
                <div className="status-breakdown__row" key={status}>
                  <span className={`status-dot status-dot--${status}`} />
                  <span className="status-breakdown__label">{status}</span>
                  <div className="status-breakdown__bar"><span style={{ width: `${total ? (count / total) * 100 : 0}%` }} /></div>
                  <strong>{count}</strong>
                </div>
              );
            })}
          </div>
          <div className="status-breakdown__summary">
            <CheckCircle2 size={16} />
            <div>
              <strong>{summary.orders} completed orders</strong>
              <span>{summary.cancelledOrders} cancelled of {summary.orders + summary.cancelledOrders} total</span>
            </div>
          </div>
        </section>
      </div>

      <div className="report-footer-note">
        <IndianRupee size={15} />
        <p>
          Revenue is based on successfully paid payment records. Cancelled orders are excluded from order counts and
          tax totals. Download the CSV for a full order-level ledger.
        </p>
        <button type="button" onClick={exportCsv} className="text-link">Download CSV <ArrowUpRight size={13} /></button>
      </div>
    </div>
  );
}
