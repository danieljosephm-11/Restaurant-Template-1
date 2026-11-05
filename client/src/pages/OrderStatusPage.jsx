import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  ChefHat,
  Clock3,
  CreditCard,
  FileText,
  Leaf,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import { useApiQuery, useDocumentTitle, useInterval } from "../hooks/useApiQuery.js";
import { formatDate, formatTime, money, ORDER_STATUS, ORDER_STATUS_FLOW, timeAgo } from "../lib/format.js";
import { api } from "../lib/api.js";
import { getSocket, watchOrder } from "../lib/socket.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Logo } from "../components/Logo.jsx";
import { Button, ErrorState, Skeleton, VegMark } from "../components/ui.jsx";
import { OrderStatusBadge, PaymentStatusBadge } from "../components/StatusBadge.jsx";

const STEP_ICONS = {
  placed: ReceiptText,
  accepted: ChefHat,
  preparing: UtensilsCrossed,
  ready: BellRing,
  served: Sparkles,
};

function OrderTimeline({ status }) {
  if (status === "cancelled") {
    return (
      <div className="cancelled-panel">
        <span className="cancelled-panel__icon">
          <XCircle size={22} />
        </span>
        <div>
          <h3>This order was cancelled</h3>
          <p>Please speak with a member of the team if you need anything else.</p>
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(status);

  return (
    <ol className="order-timeline">
      {ORDER_STATUS_FLOW.map((step, index) => {
        const Icon = STEP_ICONS[step];
        const meta = ORDER_STATUS[step];
        const complete = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={step}
            className={`order-timeline__step ${complete ? "is-complete" : ""} ${active ? "is-active" : ""}`}
          >
            <span className="order-timeline__marker">
              {complete ? <Check size={16} /> : <Icon size={16} />}
            </span>
            <div className="order-timeline__copy">
              <strong>{meta.label}</strong>
              <span>{meta.description}</span>
            </div>
            {active ? <span className="order-timeline__pulse">Now</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderStatusPage() {
  const { orderToken } = useParams();
  const { token: authToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, refetch } = useApiQuery(`/public/orders/${orderToken}`);
  const [paying, setPaying] = useState(false);
  const [live, setLive] = useState(false);

  useDocumentTitle(data?.orderCode ? `Order ${data.orderCode}` : "Your order");

  const refresh = useCallback(() => {
    refetch({ silent: true });
  }, [refetch]);

  useEffect(() => {
    const socket = getSocket(authToken);
    if (!socket) return undefined;
    const unwatch = watchOrder(socket, orderToken);
    const onUpdate = () => {
      setLive(true);
      refresh();
      window.setTimeout(() => setLive(false), 2800);
    };
    socket.on("order:updated", onUpdate);
    socket.on("connect", refresh);
    return () => {
      unwatch();
      socket.off("order:updated", onUpdate);
      socket.off("connect", refresh);
    };
  }, [authToken, orderToken, refresh]);

  useInterval(refresh, 20_000);

  const status = data?.status;
  const currentStep = useMemo(() => ORDER_STATUS[status] || {}, [status]);

  async function startPayment() {
    setPaying(true);
    try {
      const session = await api(`/public/orders/${orderToken}/payment-session`, { method: "POST", body: {} });
      navigate(`/payment/${session.sessionToken}`);
    } catch (err) {
      toast.error(err.message);
      refresh();
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="customer-page status-page">
        <div className="status-loading">
          <Skeleton width={120} height={18} />
          <Skeleton width={340} height={44} />
          <div className="status-loading__grid">
            <Skeleton height={380} radius={20} />
            <Skeleton height={280} radius={20} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-error-page">
        <Logo withWordmark size={40} />
        <ErrorState title="We couldn't find that order" message={error.message} onRetry={refetch} />
        <Link to="/" className="text-link">
          <ArrowLeft size={15} /> Back to SmartDine
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const restaurant = data.restaurant;

  return (
    <div className="customer-page order-page">
      <header className="customer-header customer-header--slim">
        <div className="customer-header__inner">
          <Link to="/" className="customer-header__brand" aria-label="SmartDine home">
            <Logo size={36} />
            <span>
              <strong>{restaurant.name}</strong>
              <small>{data.table.name}</small>
            </span>
          </Link>
          <div className="order-page__head-actions">
            <span className={`live-indicator ${live ? "is-flashing" : ""}`}>
              <span className="live-dot" /> Live
            </span>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={refresh}>
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="order-main">
        <div className="order-main__top">
          <div>
            <Link to={`/t/${data.publicToken ? "" : ""}`} onClick={(event) => event.preventDefault()} className="back-link" aria-hidden="true" />
            <span className="eyebrow eyebrow--plain">
              <span className="eyebrow__spark">✦</span> Order {data.orderCode} · {data.table.name}
            </span>
            <h1>
              {status === "served" ? "Enjoy every bite." : status === "cancelled" ? "Order cancelled." : "We're on it."}
            </h1>
            <p className="order-main__lede">
              {status === "served"
                ? `Served on ${formatDate(data.servedAt || data.updatedAt)}. Thank you for dining with us.`
                : status === "ready"
                  ? "Your food is ready and on its way to the table."
                  : status === "cancelled"
                    ? "No payment is due for this order."
                    : `Placed at ${formatTime(data.createdAt)} · ${currentStep.description || "Sit tight, the kitchen is looking after you."}`}
            </p>
          </div>
          <div className="order-meta-chips">
            <OrderStatusBadge status={status} />
            <PaymentStatusBadge status={data.paymentStatus} />
            {status !== "cancelled" && status !== "served" ? (
              <span className="soft-chip">
                <Clock3 size={13} /> {timeAgo(data.createdAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="order-layout">
          <div className="order-col">
            <section className="panel status-panel">
              <div className="panel__head">
                <div>
                  <span className="panel__eyebrow">Live progress</span>
                  <h2>From kitchen to table</h2>
                </div>
                {live ? <span className="live-update">Updated just now</span> : null}
              </div>
              <OrderTimeline status={status} />
              {status !== "served" && status !== "cancelled" ? (
                <div className="status-panel__note">
                  <Sparkles size={15} />
                  This page updates automatically as the kitchen moves your order along.
                </div>
              ) : null}
            </section>

            <section className="panel order-items-panel">
              <div className="panel__head">
                <div>
                  <span className="panel__eyebrow">On your table</span>
                  <h2>
                    {totalItems} {totalItems === 1 ? "item" : "items"}
                  </h2>
                </div>
                <span className="panel__muted">Ordered {formatTime(data.createdAt)}</span>
              </div>
              <div className="receipt-items">
                {data.items.map((item, index) => (
                  <div className="receipt-item" key={`${item.name}-${index}`}>
                    <span className="receipt-item__qty">{item.quantity}×</span>
                    <div className="receipt-item__name">
                      <VegMark isVeg={item.isVeg} size="sm" />
                      <strong>{item.name}</strong>
                    </div>
                    <span className="receipt-item__unit">{money(item.price, restaurant.currency)} each</span>
                    <strong>{money(item.lineTotal, restaurant.currency)}</strong>
                  </div>
                ))}
              </div>
              {data.notes ? (
                <div className="order-note">
                  <span>Note for the kitchen</span>
                  <p>{data.notes}</p>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="order-col order-col--aside">
            <section className="panel bill-panel">
              <div className="panel__head">
                <div>
                  <span className="panel__eyebrow">Bill summary</span>
                  <h2>Your total</h2>
                </div>
                <ReceiptText size={19} className="panel__icon" />
              </div>
              <div className="bill-lines">
                <div>
                  <span>Subtotal</span>
                  <span>{money(data.subtotal, restaurant.currency)}</span>
                </div>
                <div>
                  <span>GST ({restaurant.taxPercent}%)</span>
                  <span>{money(data.tax, restaurant.currency)}</span>
                </div>
                {data.serviceCharge > 0 ? (
                  <div>
                    <span>Service charge</span>
                    <span>{money(data.serviceCharge, restaurant.currency)}</span>
                  </div>
                ) : null}
                <div className="bill-lines__total">
                  <span>Total</span>
                  <strong>{money(data.total, restaurant.currency)}</strong>
                </div>
              </div>

              {data.paymentStatus === "paid" ? (
                <div className="payment-confirmed">
                  <span className="payment-confirmed__icon">
                    <Check size={18} />
                  </span>
                  <div>
                    <strong>Payment complete</strong>
                    <span>
                      {data.payment?.method || "UPI"} · {data.payment?.paidAt ? formatDateTimeShort(data.payment.paidAt) : "Paid"}
                    </span>
                  </div>
                </div>
              ) : data.canPay ? (
                <div className="bill-payment-actions">
                  <Button variant="primary" size="lg" fullWidth icon={CreditCard} onClick={startPayment} loading={paying}>
                    {data.paymentStatus === "pending" ? "Restart payment" : "Pay online"}
                  </Button>
                  <Link to={`/bill/${data.publicToken}`} className="button button--ghost button--md button--full">
                    <FileText size={16} /> View digital bill
                  </Link>
                  <p className="secure-note">
                    <ShieldCheck size={13} /> Secure, order-linked payment. Your card details never touch our servers.
                  </p>
                </div>
              ) : status !== "cancelled" ? (
                <Link to={`/bill/${data.publicToken}`} className="button button--secondary button--md button--full">
                  <FileText size={16} /> View digital bill
                </Link>
              ) : null}
            </section>

            {data.canPay ? (
              <div className="aside-card aside-card--help">
                <CreditCard size={18} />
                <div>
                  <strong>Prefer to pay at the counter?</strong>
                  <p>That's perfectly fine. Show this order number to our team.</p>
                </div>
              </div>
            ) : null}

            <div className="aside-card aside-card--restaurant">
              <Leaf size={17} />
              <div>
                <strong>{restaurant.name}</strong>
                <p>{restaurant.address}</p>
                <span>{restaurant.phone}</span>
              </div>
            </div>

            <Link to="/" className="back-link">
              <ArrowLeft size={15} /> SmartDine home
            </Link>
          </aside>
        </div>
      </main>

      <footer className="customer-footer">
        <p>
          Questions? Ask our team at {data.table.name} · {restaurant.phone}
        </p>
        <span>
          <Logo size={20} /> SmartDine
        </span>
      </footer>
    </div>
  );
}

function formatDateTimeShort(dateLike) {
  return `${formatDate(dateLike)} · ${formatTime(dateLike)}`;
}
