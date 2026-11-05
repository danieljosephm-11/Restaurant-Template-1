import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Ban,
  Check,
  ChefHat,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  ReceiptText,
  RefreshCw,
  Search,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useApiQuery, useDocumentTitle, useDebounced, useInterval } from "../../hooks/useApiQuery.js";
import { getSocket } from "../../lib/socket.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { ORDER_STATUS, classNames, formatDateTime, formatTime, money, timeAgo } from "../../lib/format.js";
import { api } from "../../lib/api.js";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  IconButton,
  Modal,
  Select,
  Skeleton,
  VegMark,
} from "../../components/ui.jsx";
import { OrderStatusBadge, PaymentStatusBadge } from "../../components/StatusBadge.jsx";

const TRANSITIONS = {
  placed: { next: "accepted", label: "Accept order", icon: Check, variant: "primary" },
  accepted: { next: "preparing", label: "Start preparing", icon: ChefHat, variant: "primary" },
  preparing: { next: "ready", label: "Mark ready", icon: Clock3, variant: "primary" },
  ready: { next: "served", label: "Mark served", icon: UtensilsCrossed, variant: "primary" },
};

function OrderDetail({ order, loading, onClose, onTransition, transitioning, onCancel }) {
  const items = order?.items || [];
  const payment = order?.payments?.[0];
  const next = order ? TRANSITIONS[order.status] : null;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      className="order-detail-modal"
      title={order ? order.orderCode : "Order details"}
      description={order ? `${order.table.name} · placed ${formatDateTime(order.createdAt)}` : undefined}
      footer={
        order ? (
          <>
            <div className="order-detail__footer-left">
              {order.status !== "cancelled" && order.status !== "served" ? (
                <Button variant="ghost" size="sm" icon={Ban} onClick={onCancel}>
                  Cancel order
                </Button>
              ) : null}
            </div>
            <div className="order-detail__footer-actions">
              <a href={`/bill/${order.publicToken}`} target="_blank" rel="noreferrer" className="button button--secondary button--sm">
                <FileText size={14} /> Invoice
              </a>
              {next ? (
                <Button
                  variant={next.variant}
                  icon={next.icon}
                  loading={transitioning}
                  onClick={() => onTransition(next.next)}
                >
                  {next.label}
                </Button>
              ) : (
                <Button variant="ghost" onClick={onClose}>Close</Button>
              )}
            </div>
          </>
        ) : null
      }
    >
      {loading || !order ? (
        <div className="order-detail-loading">
          <Skeleton height={32} radius={8} />
          <Skeleton height={180} radius={12} />
          <Skeleton height={120} radius={12} />
        </div>
      ) : (
        <div className="order-detail">
          <div className="order-detail__status">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <span className="soft-chip"><Clock3 size={12} /> {timeAgo(order.createdAt)}</span>
            <a href={`/order/${order.publicToken}`} target="_blank" rel="noreferrer" className="order-detail__guest-link">
              Guest view <ExternalLink size={12} />
            </a>
          </div>

          <div className="order-detail__items">
            <div className="order-detail__section-head">
              <div>
                <span>Items</span>
                <strong>{items.reduce((sum, item) => sum + item.quantity, 0)} total</strong>
              </div>
              <span>{order.table.name}</span>
            </div>
            {items.map((item, index) => (
              <div className="order-detail__item" key={`${item.name}-${index}`}>
                <span className="order-detail__qty">{item.quantity}×</span>
                <span className="order-detail__item-name"><VegMark isVeg={item.isVeg} size="sm" /> {item.name}</span>
                <span>{money(item.price)}</span>
                <strong>{money(item.lineTotal)}</strong>
              </div>
            ))}
          </div>

          {order.notes ? (
            <div className="order-detail__note">
              <strong>Kitchen note</strong>
              <p>{order.notes}</p>
            </div>
          ) : null}

          <div className="order-detail__grid">
            <div className="order-detail__totals">
              <div><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
              <div><span>GST ({order.restaurant.taxPercent}%)</span><span>{money(order.tax)}</span></div>
              {order.serviceCharge > 0 ? <div><span>Service charge</span><span>{money(order.serviceCharge)}</span></div> : null}
              <div className="order-detail__total"><span>Total</span><strong>{money(order.total)}</strong></div>
            </div>

            <div className="order-detail__payments">
              <span className="order-detail__section-label">Payment history</span>
              {order.payments.length === 0 ? (
                <p className="order-detail__muted">No payment attempts yet.</p>
              ) : (
                order.payments.slice(0, 4).map((row) => (
                  <div className="order-payment-row" key={row.id}>
                    <span className={`payment-status-dot is-${row.status}`} />
                    <div>
                      <strong>{row.paymentCode}</strong>
                      <span>{row.method} · {formatTime(row.createdAt)}</span>
                    </div>
                    <div>
                      <PaymentStatusBadge status={row.status} />
                      <strong>{money(row.amount)}</strong>
                    </div>
                  </div>
                ))
              )}
              {payment?.transactionId ? (
                <div className="order-detail__txn">
                  <span>Transaction</span>
                  <code>{payment.transactionId}</code>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AdminOrdersPage() {
  useDocumentTitle("Orders");
  const { token } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(() => {
    const value = searchParams.get("status");
    return value && ["active", "all", ...Object.keys(ORDER_STATUS)].includes(value) ? value : "all";
  });
  const [payment, setPayment] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [detailId, setDetailId] = useState(() => searchParams.get("focus") || null);
  const [transitioning, setTransitioning] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (payment && payment !== "all") params.set("payment", payment);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    params.set("limit", "250");
    return params.toString();
  }, [status, payment, debouncedSearch]);

  const listPath = `/admin/orders${query ? `?${query}` : ""}`;
  const { data, loading, error, refetch, refreshing } = useApiQuery(listPath);
  const detailPath = `/admin/orders/${detailId || "none"}`;
  const {
    data: detail,
    loading: detailLoading,
    refetch: refetchDetail,
  } = useApiQuery(detailPath, { enabled: !!detailId });

  const refresh = useCallback(() => {
    refetch({ silent: true });
    if (detailId) refetchDetail({ silent: true });
  }, [refetch, refetchDetail, detailId]);

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

  useInterval(refresh, 25_000);

  useEffect(() => {
    const focus = searchParams.get("focus");
    if (focus) setDetailId(focus);
  }, [searchParams]);

  function closeDetail() {
    setDetailId(null);
    if (searchParams.get("focus")) {
      const next = new URLSearchParams(searchParams);
      next.delete("focus");
      setSearchParams(next, { replace: true });
    }
  }

  async function changeStatus(nextStatus) {
    if (!detail) return;
    setTransitioning(true);
    try {
      await api(`/admin/orders/${detail.id}/status`, { method: "PATCH", body: { status: nextStatus } });
      toast.success(`Order ${detail.orderCode} moved to ${ORDER_STATUS[nextStatus]?.label || nextStatus}.`);
      await refetchDetail({ silent: true });
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTransitioning(false);
    }
  }

  async function cancelOrder() {
    if (!detail) return;
    setCancelling(true);
    try {
      await api(`/admin/orders/${detail.id}/status`, { method: "PATCH", body: { status: "cancelled" } });
      toast.success(`Order ${detail.orderCode} cancelled.`);
      setCancelOpen(false);
      await refetchDetail({ silent: true });
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  }

  const counts = useMemo(() => {
    const map = {};
    for (const row of data?.counts || []) map[row.status] = row.count;
    return map;
  }, [data]);
  const activeCount = (counts.placed || 0) + (counts.accepted || 0) + (counts.preparing || 0) + (counts.ready || 0);
  const fetchedOrders = data?.orders || [];

  return (
    <div className="admin-page admin-orders-page">
      <header className="admin-page__head">
        <div>
          <span className="admin-page__eyebrow"><ClipboardList size={13} /> Service ledger</span>
          <h1>Orders, in real time.</h1>
          <p>Track every table's order from the pass to payment. Click any order for the full ticket.</p>
        </div>
        <div className="admin-page__actions">
          <span className="admin-page__updated"><span className="live-dot" /> Live sync</span>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refresh} loading={refreshing}>Refresh</Button>
          <Link to="/kitchen" className="button button--primary button--sm"><ChefHat size={16} /> Kitchen display</Link>
        </div>
      </header>

      <div className="menu-stats">
        <div className="menu-stat"><span><ClipboardList size={17} /></span><div><strong>{activeCount}</strong><small>Active now</small></div></div>
        <div className="menu-stat"><span className="is-amber"><Clock3 size={17} /></span><div><strong>{counts.placed || 0}</strong><small>New orders</small></div></div>
        <div className="menu-stat"><span className="is-green"><Check size={17} /></span><div><strong>{counts.served || 0}</strong><small>Served today</small></div></div>
        <div className="menu-stat"><span className="is-red"><Ban size={17} /></span><div><strong>{counts.cancelled || 0}</strong><small>Cancelled today</small></div></div>
      </div>

      <section className="admin-panel orders-panel">
        <div className="admin-toolbar orders-toolbar">
          <label className="search-box">
            <Search size={16} />
            <input type="search" placeholder="Search order, table…" value={search} onChange={(event) => setSearch(event.target.value)} />
            {search ? <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button> : null}
          </label>
          <div className="admin-toolbar__right">
            <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by order status">
              <option value="all">All orders</option>
              <option value="active">Active orders</option>
              {Object.entries(ORDER_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </Select>
            <Select value={payment} onChange={(event) => setPayment(event.target.value)} aria-label="Filter by payment status">
              <option value="all">All payments</option>
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </Select>
            <span className="admin-toolbar__count">{fetchedOrders.length} orders</span>
          </div>
        </div>

        {loading ? (
          <div className="orders-loading">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} height={66} radius={10} />)}</div>
        ) : error ? (
          <div className="admin-error-inline">
            <p>{error.message}</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : fetchedOrders.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No orders found"
            description="Try changing the filters or clearing the search."
            action={<Button variant="secondary" onClick={() => { setStatus("all"); setPayment("all"); setSearch(""); }}>Clear filters</Button>}
          />
        ) : (
          <div className="orders-table">
            <div className="orders-table__head">
              <span>Order</span>
              <span>Table</span>
              <span>Placed</span>
              <span>Items</span>
              <span>Total</span>
              <span>Order status</span>
              <span>Payment</span>
              <span />
            </div>
            {fetchedOrders.map((order) => (
              <button
                type="button"
                key={order.id}
                className={classNames("orders-row", order.status === "cancelled" && "is-cancelled")}
                onClick={() => setDetailId(order.id)}
              >
                <span className="orders-row__code">
                  <span className="orders-row__id">{order.orderCode}</span>
                  {order.notes ? <span className="orders-row__note" title={order.notes}>Note</span> : null}
                </span>
                <span className="orders-row__table">
                  <span className="orders-row__table-mark">{String(order.table.number).padStart(2, "0")}</span>
                  {order.table.name}
                </span>
                <span className="orders-row__time">
                  <strong>{formatTime(order.createdAt)}</strong>
                  <small>{timeAgo(order.createdAt)}</small>
                </span>
                <span>{order.itemCount}</span>
                <strong className="orders-row__total">{money(order.total)}</strong>
                <span><OrderStatusBadge status={order.status} /></span>
                <span><PaymentStatusBadge status={order.paymentStatus} /></span>
                <span className="orders-row__open"><ArrowRight size={16} /></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {detailId ? (
        <OrderDetail
          order={detail}
          loading={detailLoading}
          onClose={closeDetail}
          onTransition={changeStatus}
          transitioning={transitioning}
          onCancel={() => setCancelOpen(true)}
        />
      ) : null}

      <Modal
        open={cancelOpen}
        onClose={() => !cancelling && setCancelOpen(false)}
        title={`Cancel ${detail?.orderCode}?`}
        description="The kitchen will be notified and the table's order will be closed. This cannot be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>Keep order</Button>
            <Button variant="danger" onClick={cancelOrder} loading={cancelling}>Cancel order</Button>
          </>
        }
      >
        <div className="cancel-warning"><Ban size={22} /><p>If the guest has already paid, handle the refund from the Payments page after cancelling.</p></div>
      </Modal>
    </div>
  );
}
