import { useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChefHat,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Flame,
  IndianRupee,
  LayoutGrid,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";
import { useApiQuery, useDocumentTitle, useInterval } from "../../hooks/useApiQuery.js";
import { getSocket } from "../../lib/socket.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatTime, money, timeAgo, greeting, classNames } from "../../lib/format.js";
import { Button, Skeleton } from "../../components/ui.jsx";
import { OrderStatusBadge, PaymentStatusBadge } from "../../components/StatusBadge.jsx";

function StatCard({ icon: Icon, label, value, sub, tone = "green", change = null }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__top">
        <span className="stat-card__icon">
          <Icon size={19} />
        </span>
        {change !== null && change !== undefined ? (
          <span className={`stat-card__change ${change >= 0 ? "is-up" : "is-down"}`}>
            {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {change >= 0 ? "+" : ""}
            {change}%
          </span>
        ) : null}
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub ? <div className="stat-card__sub">{sub}</div> : null}
    </article>
  );
}

function RevenueChart({ series }) {
  const { path, areaPath, max, points } = useMemo(() => {
    const data = series || [];
    const width = 640;
    const height = 190;
    const top = 18;
    const bottom = 160;
    const maxValue = Math.max(1, ...data.map((item) => item.revenue));
    const pointsList = data.map((item, index) => {
      const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
      const y = bottom - (item.revenue / maxValue) * (bottom - top);
      return { ...item, x, y };
    });
    const line = pointsList.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x},${point.y}`).join(" ");
    const area = pointsList.length
      ? `${line} L ${pointsList[pointsList.length - 1].x},${bottom} L ${pointsList[0].x},${bottom} Z`
      : "";
    return { path: line, areaPath: area, max: maxValue, points: pointsList };
  }, [series]);

  return (
    <div className="revenue-chart">
      <div className="revenue-chart__grid" aria-hidden="true">
        {[0, 1, 2, 3].map((line) => (
          <span key={line} style={{ bottom: `${line * 33}%` }} />
        ))}
      </div>
      <svg viewBox="0 0 640 190" role="img" aria-label="Revenue over the last seven days">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f6b4f" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#2f6b4f" stopOpacity="0" />
          </linearGradient>
        </defs>
        {areaPath ? <path d={areaPath} fill="url(#chartFill)" /> : null}
        {path ? <path d={path} fill="none" stroke="#173d2c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="4.5" fill="#fffdf8" stroke="#173d2c" strokeWidth="2.5" />
            <title>{`${point.label}: ${money(point.revenue)} · ${point.orders} orders`}</title>
          </g>
        ))}
      </svg>
      <div className="revenue-chart__labels">
        {series.map((item) => (
          <span key={item.date}>
            <strong>{item.label}</strong>
            <small>{item.orders}</small>
          </span>
        ))}
      </div>
      <div className="revenue-chart__max">Peak {money(max)}</div>
    </div>
  );
}

export default function DashboardPage() {
  useDocumentTitle("Overview");
  const { token } = useAuth();
  const { data, loading, error, refetch, refreshing } = useApiQuery("/admin/dashboard");

  useDocumentTitle("Dashboard");

  const refresh = useCallback(() => refetch({ silent: true }), [refetch]);

  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return undefined;
    const events = ["order:created", "order:updated", "payment:updated", "table:updated"];
    events.forEach((event) => socket.on(event, refresh));
    socket.on("connect", refresh);
    return () => {
      events.forEach((event) => socket.off(event, refresh));
      socket.off("connect", refresh);
    };
  }, [token, refresh]);

  useInterval(refresh, 30_000);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__head">
          <Skeleton width={280} height={42} />
          <Skeleton width={120} height={38} radius={10} />
        </div>
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} height={150} radius={16} />
          ))}
        </div>
        <div className="dashboard-grid">
          <Skeleton height={380} radius={18} />
          <Skeleton height={380} radius={18} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error-panel">
          <h2>We couldn't load the dashboard</h2>
          <p>{error.message}</p>
          <Button variant="primary" onClick={refresh}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { today } = data;
  const revenueChange =
    today.revenueChangePercent === null || today.revenueChangePercent === undefined
      ? null
      : today.revenueChangePercent;
  const totalTable = today.totalTables || 0;
  const activeTable = today.activeTables || 0;
  const occupancy = totalTable ? Math.round((activeTable / totalTable) * 100) : 0;

  return (
    <div className="admin-page dashboard-page">
      <header className="admin-page__head">
        <div>
          <span className="admin-page__eyebrow">
            <Sparkles size={13} /> {greeting()}, {new Date().toLocaleDateString("en-IN", { weekday: "long" })}
          </span>
          <h1>Service overview</h1>
          <p>Here's how {data.recentOrders[0] ? "Spice Route" : "your restaurant"} is doing today.</p>
        </div>
        <div className="admin-page__actions">
          <span className="admin-page__updated">
            <span className={classNames("live-dot", refreshing && "is-pulsing")} /> Updated {formatTime(new Date())}
          </span>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refresh} loading={refreshing}>
            Refresh
          </Button>
          <Link to="/kitchen" className="button button--primary button--sm">
            <ChefHat size={16} /> Kitchen
          </Link>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          icon={IndianRupee}
          label="Revenue today"
          value={money(today.revenue)}
          sub={`${today.paidOrders} paid orders · vs ${money(today.yesterdayRevenue)} yesterday`}
          change={revenueChange}
          tone="green"
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders today"
          value={today.orders}
          sub={`${today.activeOrders} currently active · ${today.yesterdayOrders} yesterday`}
          tone="terracotta"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Average order"
          value={money(today.averageOrder)}
          sub="Across paid orders today"
          tone="gold"
        />
        <StatCard
          icon={Banknote}
          label="Pending payments"
          value={today.pendingPayments}
          sub={`${today.activeTables} of ${today.totalTables} tables occupied`}
          tone="slate"
        />
      </section>

      <div className="dashboard-grid">
        <section className="admin-panel admin-panel--chart">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Last 7 days</span>
              <h2>Revenue rhythm</h2>
            </div>
            <div className="chart-legend">
              <span className="chart-legend__dot" /> Revenue
              <span className="chart-legend__bar" /> Order count
            </div>
          </div>
          <RevenueChart series={data.series} />
          <div className="chart-summary">
            <div>
              <span>7-day revenue</span>
              <strong>{money(data.series.reduce((sum, point) => sum + point.revenue, 0))}</strong>
            </div>
            <div>
              <span>7-day orders</span>
              <strong>{data.series.reduce((sum, point) => sum + point.orders, 0)}</strong>
            </div>
            <div>
              <span>Best day</span>
              <strong>
                {data.series.reduce((best, point) => (point.revenue > best.revenue ? point : best), data.series[0] || { label: "—" }).label}
              </strong>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-panel--floor">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Live floor</span>
              <h2>Tables at a glance</h2>
            </div>
            <Link to="/admin/tables" className="panel-link">
              Manage <ArrowRight size={14} />
            </Link>
          </div>
          <div className="floor-meta">
            <div>
              <strong>{activeTable}</strong>
              <span>of {totalTable} tables active</span>
            </div>
            <div className="floor-meta__occupancy">
              <span style={{ width: `${occupancy}%` }} />
            </div>
            <strong>{occupancy}%</strong>
          </div>
          <div className="floor-grid">
            {data.tables.map((table) => (
              <Link
                to="/admin/tables"
                key={table.id}
                className={classNames("floor-tile", `is-${table.status}`)}
                title={`${table.name}: ${table.status}`}
              >
                <span className="floor-tile__number">{String(table.number).padStart(2, "0")}</span>
                <span className="floor-tile__status">
                  {table.activeOrders > 0 ? `${table.activeOrders} active` : table.status}
                </span>
              </Link>
            ))}
          </div>
          <div className="floor-legend">
            <span><i className="dot dot--green" /> Available</span>
            <span><i className="dot dot--amber" /> Occupied</span>
            <span><i className="dot dot--blue" /> Reserved</span>
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--secondary">
        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Right now</span>
              <h2>Live orders</h2>
            </div>
            <Link to="/admin/orders?status=active" className="panel-link">
              All orders <ArrowRight size={14} />
            </Link>
          </div>
          {data.liveOrders.length === 0 ? (
            <div className="quiet-state">
              <span><UtensilsCrossed size={20} /></span>
              <p>No active orders — the pass is quiet.</p>
            </div>
          ) : (
            <div className="live-order-list">
              {data.liveOrders.map((order) => (
                <Link to={`/admin/orders?focus=${order.id}`} className="live-order" key={order.id}>
                  <span className="live-order__table">{order.tableName?.replace("Table ", "") || "—"}</span>
                  <div className="live-order__main">
                    <strong>{order.orderCode}</strong>
                    <span>{order.itemCount} items · {money(order.total)}</span>
                  </div>
                  <OrderStatusBadge status={order.status} />
                  <span className="live-order__time">{timeAgo(order.createdAt)}</span>
                  <ArrowRight size={15} className="live-order__arrow" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Last 7 days</span>
              <h2>Most loved dishes</h2>
            </div>
            <Link to="/admin/reports" className="panel-link">
              Reports <ArrowRight size={14} />
            </Link>
          </div>
          <div className="top-dish-list">
            {data.topItems.map((item, index) => (
              <div className="top-dish" key={item.name}>
                <span className="top-dish__rank">{String(index + 1).padStart(2, "0")}</span>
                <span className={classNames("top-dish__veg", item.isVeg ? "is-veg" : "is-nonveg")}>
                  <i />
                </span>
                <div className="top-dish__main">
                  <strong>{item.name}</strong>
                  <span>{item.qty} plates sold</span>
                </div>
                <strong className="top-dish__revenue">{money(item.revenue)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Today</span>
              <h2>Payment mix</h2>
            </div>
            <WalletCards size={18} className="panel__icon" />
          </div>
          {data.paymentSplit.length === 0 ? (
            <div className="quiet-state">
              <span><CreditCard size={20} /></span>
              <p>No payments collected yet today.</p>
            </div>
          ) : (
            <div className="payment-mix">
              {data.paymentSplit.map((item) => {
                const total = data.paymentSplit.reduce((sum, row) => sum + row.total, 0);
                const percent = total ? Math.round((item.total / total) * 100) : 0;
                return (
                  <div className="payment-mix__row" key={item.method}>
                    <div className="payment-mix__label">
                      <span className={`payment-method-icon payment-method-icon--${item.method.toLowerCase()}`}>
                        {item.method === "CASH" ? <Banknote size={14} /> : item.method === "CARD" ? <CreditCard size={14} /> : <WalletCards size={14} />}
                      </span>
                      <strong>{item.method}</strong>
                      <span>{item.count} payments</span>
                    </div>
                    <div className="payment-mix__bar">
                      <span style={{ width: `${percent}%` }} />
                    </div>
                    <strong>{money(item.total)}</strong>
                  </div>
                );
              })}
            </div>
          )}
          <div className="payment-mix__footer">
            <span>Collected today</span>
            <strong>{money(today.revenue)}</strong>
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--third">
        <section className="admin-panel admin-panel--wide">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Latest activity</span>
              <h2>What's happening</h2>
            </div>
            <span className="admin-panel__meta">Auto-updating</span>
          </div>
          <div className="activity-feed">
            {data.activity.map((item) => (
              <div className="activity" key={item.id}>
                <span className="activity__dot" />
                <div>
                  <strong>{item.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong>
                  <span>{item.detail}</span>
                </div>
                <time>{timeAgo(item.created_at)}</time>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel__head">
            <div>
              <span className="admin-panel__eyebrow">Recent</span>
              <h2>Order log</h2>
            </div>
            <Link to="/admin/orders" className="panel-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="recent-order-list">
            {data.recentOrders.slice(0, 5).map((order) => (
              <Link to={`/admin/orders?focus=${order.id}`} className="recent-order" key={order.id}>
                <span className="recent-order__code">{order.orderCode}</span>
                <span className="recent-order__table">{order.tableName}</span>
                <span className="recent-order__total">{money(order.total)}</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
