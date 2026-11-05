import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  CreditCard,
  FileText,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react";
import { useApiQuery, useDocumentTitle, useInterval } from "../hooks/useApiQuery.js";
import { formatDate, formatTime, money, timeAgo } from "../lib/format.js";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { Logo } from "../components/Logo.jsx";
import { Button, EmptyState, ErrorState, Skeleton } from "../components/ui.jsx";
import { OrderStatusBadge, PaymentStatusBadge } from "../components/StatusBadge.jsx";

export default function TableBillPage() {
  const { tableToken } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, refetch } = useApiQuery(`/public/tables/${tableToken}/bill`);
  const [payingId, setPayingId] = useState(null);

  useDocumentTitle(data?.restaurant?.name ? `${data.table.name} bill` : "Table bill");

  const refresh = useCallback(() => {
    refetch({ silent: true });
  }, [refetch]);

  useInterval(refresh, 20_000);

  async function payOrder(order) {
    setPayingId(order.publicToken);
    try {
      const session = await api(`/public/orders/${order.publicToken}/payment-session`, {
        method: "POST",
        body: {},
      });
      navigate(`/payment/${session.sessionToken}`);
    } catch (err) {
      toast.error(err.message);
      refresh();
    } finally {
      setPayingId(null);
    }
  }

  if (loading) {
    return (
      <div className="customer-page bill-landing">
        <div className="bill-loading">
          <Skeleton width={180} height={16} />
          <Skeleton width={420} height={54} />
          <Skeleton height={150} radius={20} />
          <Skeleton height={280} radius={20} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-error-page">
        <Logo withWordmark size={40} />
        <ErrorState title="This payment QR isn't active" message={error.message} onRetry={refetch} />
        <Link to="/" className="text-link">
          <ArrowLeft size={15} /> Back to SmartDine
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const restaurant = data.restaurant;
  const outstandingOrders = data.orders.filter(
    (order) => !["paid", "refunded"].includes(order.paymentStatus) && order.status !== "cancelled"
  );
  const paidOrders = data.orders.filter((order) => ["paid", "refunded"].includes(order.paymentStatus));
  const allSettled = outstandingOrders.length === 0;

  return (
    <div className="customer-page bill-landing">
      <header className="customer-header customer-header--slim">
        <div className="customer-header__inner">
          <Link to="/" className="customer-header__brand" aria-label="SmartDine home">
            <Logo size={36} />
            <span>
              <strong>{restaurant.name}</strong>
              <small>Pay at your table</small>
            </span>
          </Link>
          <div className="bill-head-actions">
            <span className="table-pill">
              <span className="table-pill__dot" />
              {data.table.name}
            </span>
            <Link to={`/t/${tableToken}`} className="button button--ghost button--sm">
              <UtensilsCrossed size={15} /> Menu
            </Link>
          </div>
        </div>
      </header>

      <main className="bill-landing__main">
        <section className="bill-hero">
          <div className="bill-hero__copy">
            <span className="eyebrow eyebrow--plain">
              <span className="eyebrow__spark">✦</span> Table {data.table.number} · Last {data.windowHours} hours
            </span>
            <h1>
              Your table,
              <br />
              <em>{allSettled ? "all settled." : "ready to pay."}</em>
            </h1>
            <p>
              Each order below has its own secure payment link. The amount is always calculated by our system — never
              by a static QR code.
            </p>
          </div>
          <div className={`outstanding-card ${allSettled ? "is-settled" : ""}`}>
            {allSettled ? (
              <>
                <span className="outstanding-card__icon">
                  <Check size={25} />
                </span>
                <span className="outstanding-card__eyebrow">Outstanding balance</span>
                <strong>{money(0, restaurant.currency)}</strong>
                <p>Everything on this table has been settled. Thank you.</p>
              </>
            ) : (
              <>
                <span className="outstanding-card__eyebrow">Outstanding balance</span>
                <strong>{money(data.outstanding, restaurant.currency)}</strong>
                <p>
                  Across {outstandingOrders.length} {outstandingOrders.length === 1 ? "order" : "orders"} ·{" "}
                  {paidOrders.length} already paid
                </p>
                <span className="outstanding-card__hint">
                  <ShieldCheck size={13} /> Order-linked & server verified
                </span>
              </>
            )}
          </div>
        </section>

        <div className="bill-landing__grid">
          <section className="panel orders-to-pay">
            <div className="panel__head">
              <div>
                <span className="panel__eyebrow">Open orders</span>
                <h2>Choose an order to pay</h2>
              </div>
              <span className="soft-chip">
                <Clock3 size={13} /> Updated live
              </span>
            </div>

            {data.orders.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="No orders on this table yet"
                description="Once you order from the menu, your bill will appear here."
                action={
                  <Link to={`/t/${tableToken}`} className="button button--primary button--md">
                    Browse the menu <ArrowRight size={16} />
                  </Link>
                }
              />
            ) : (
              <div className="table-order-list">
                {data.orders.map((order) => {
                  const settled = ["paid", "refunded"].includes(order.paymentStatus);
                  return (
                    <article className={`table-order ${settled ? "is-settled" : ""}`} key={order.publicToken}>
                      <div className="table-order__top">
                        <div className="table-order__id">
                          <span className={`table-order__mark ${settled ? "is-settled" : ""}`}>
                            {settled ? <Check size={17} /> : <ReceiptText size={17} />}
                          </span>
                          <div>
                            <strong>{order.orderCode}</strong>
                            <span>
                              {formatTime(order.createdAt)} · {order.itemCount}{" "}
                              {order.itemCount === 1 ? "item" : "items"} · {timeAgo(order.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="table-order__badges">
                          <OrderStatusBadge status={order.status} />
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </div>
                      </div>
                      <div className="table-order__bottom">
                        <div>
                          <small>Order total</small>
                          <strong>{money(order.total, restaurant.currency)}</strong>
                        </div>
                        <div className="table-order__actions">
                          <Link to={`/order/${order.publicToken}`} className="button button--ghost button--sm">
                            View order
                          </Link>
                          {settled ? (
                            <Link to={`/bill/${order.publicToken}`} className="button button--secondary button--sm">
                              <FileText size={14} /> Receipt
                            </Link>
                          ) : order.status === "cancelled" ? null : (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={CreditCard}
                              loading={payingId === order.publicToken}
                              onClick={() => payOrder(order)}
                            >
                              {order.paymentStatus === "pending" ? "Restart payment" : "Pay now"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="bill-aside">
            <div className="aside-card aside-card--how">
              <span className="aside-card__eyebrow">How it works</span>
              <h3>A payment QR that knows your order.</h3>
              <ol className="how-list">
                <li>
                  <span>1</span>
                  <p>Choose the order you'd like to settle.</p>
                </li>
                <li>
                  <span>2</span>
                  <p>A fresh payment session is created for that exact amount.</p>
                </li>
                <li>
                  <span>3</span>
                  <p>Scan with any UPI app, or complete the simulated demo payment.</p>
                </li>
                <li>
                  <span>4</span>
                  <p>Our server verifies and marks the order paid instantly.</p>
                </li>
              </ol>
            </div>

            <div className="aside-card aside-card--secure">
              <ShieldCheck size={19} />
              <div>
                <strong>Secure by design</strong>
                <p>Payment sessions expire after 15 minutes and can only settle one order. Duplicate payments are blocked.</p>
              </div>
            </div>

            <div className="aside-card aside-card--restaurant">
              <ChefHat size={18} />
              <div>
                <strong>Prefer cash or card?</strong>
                <p>Our team can take payment at the table too. Just ask.</p>
                <span>{restaurant.phone}</span>
              </div>
            </div>

            <div className="bill-aside__footer">
              <WalletCards size={15} /> UPI · Card · Cash
            </div>
          </aside>
        </div>

        <div className="bill-tip">
          <Sparkles size={16} />
          <p>
            You can keep ordering until you're ready to leave. Each new order gets its own line on this bill and its
            own payment link.
          </p>
          <Link to={`/t/${tableToken}`}>
            Back to menu <ArrowRight size={14} />
          </Link>
        </div>
      </main>

      <footer className="customer-footer">
        <p>
          {restaurant.name} · {restaurant.address}
        </p>
        <span>
          <Logo size={20} /> SmartDine
        </span>
      </footer>
    </div>
  );
}
