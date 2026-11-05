import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  ExternalLink,
  IndianRupee,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { useApiQuery, useDocumentTitle, useDebounced, useInterval } from "../../hooks/useApiQuery.js";
import { getSocket } from "../../lib/socket.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { PAYMENT_METHODS, PAYMENT_STATUS, classNames, formatDateTime, formatTime, money, timeAgo } from "../../lib/format.js";
import { api } from "../../lib/api.js";
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Modal,
  Select,
  Skeleton,
  Spinner,
} from "../../components/ui.jsx";
import { PaymentStatusBadge } from "../../components/StatusBadge.jsx";

const METHOD_ICONS = { UPI: WalletCards, CARD: CreditCard, CASH: Banknote };

export default function AdminPaymentsPage() {
  useDocumentTitle("Payments");
  const { token } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [collectTarget, setCollectTarget] = useState(null);
  const [collectMethod, setCollectMethod] = useState("CASH");
  const [transactionId, setTransactionId] = useState("");
  const [collecting, setCollecting] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refunding, setRefunding] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (method !== "all") params.set("method", method);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    params.set("limit", "250");
    return params.toString();
  }, [status, method, debouncedSearch]);

  const { data, loading, error, refetch, refreshing } = useApiQuery(`/admin/payments?${query}`);

  const refresh = useCallback(() => refetch({ silent: true }), [refetch]);

  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return undefined;
    const events = ["payment:updated", "order:updated"];
    events.forEach((event) => socket.on(event, refresh));
    socket.on("connect", refresh);
    return () => {
      events.forEach((event) => socket.off(event, refresh));
      socket.off("connect", refresh);
    };
  }, [token, refresh]);

  useInterval(refresh, 30_000);

  function openCollect(payment) {
    setCollectTarget(payment);
    setCollectMethod(payment.method && ["UPI", "CARD", "CASH"].includes(payment.method) ? payment.method : "CASH");
    setTransactionId("");
  }

  async function collectPayment() {
    if (!collectTarget) return;
    setCollecting(true);
    try {
      await api(`/admin/payments/${collectTarget.id}/mark-paid`, {
        method: "POST",
        body: { method: collectMethod, transactionId: transactionId.trim() || undefined },
      });
      toast.success(`${collectTarget.paymentCode} marked paid via ${collectMethod}.`);
      setCollectTarget(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCollecting(false);
    }
  }

  async function refundPayment() {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      await api(`/admin/payments/${refundTarget.id}/refund`, { method: "POST", body: {} });
      toast.success(`${refundTarget.paymentCode} refunded.`);
      setRefundTarget(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRefunding(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__head"><Skeleton width={270} height={40} /></div>
        <div className="menu-stats">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={100} radius={14} />)}</div>
        <Skeleton height={520} radius={18} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error-panel"><h2>Couldn't load payments</h2><p>{error.message}</p><Button onClick={() => refetch()} variant="primary">Try again</Button></div>
      </div>
    );
  }

  const summary = data?.summary || { collected: 0, pending: 0, refunded: 0, paidCount: 0, pendingCount: 0 };
  const payments = data?.payments || [];

  return (
    <div className="admin-page admin-payments-page">
      <header className="admin-page__head">
        <div>
          <span className="admin-page__eyebrow"><WalletCards size={13} /> Money & reconciliation</span>
          <h1>Payments, accounted for.</h1>
          <p>Monitor collections, record manual payments and process refunds. Every action is audited.</p>
        </div>
        <div className="admin-page__actions">
          <span className="admin-page__updated"><span className="live-dot" /> Live</span>
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refresh} loading={refreshing}>Refresh</Button>
          <Link to="/admin/reports" className="button button--primary button--sm">View reports <ArrowRight size={15} /></Link>
        </div>
      </header>

      <div className="payment-summary-cards">
        <article className="payment-summary-card payment-summary-card--collected">
          <span className="payment-summary-card__icon"><IndianRupee size={19} /></span>
          <div>
            <span>Total collected</span>
            <strong>{money(summary.collected)}</strong>
            <small>{summary.paidCount} successful payments</small>
          </div>
        </article>
        <article className="payment-summary-card payment-summary-card--pending">
          <span className="payment-summary-card__icon"><WalletCards size={19} /></span>
          <div>
            <span>Awaiting payment</span>
            <strong>{money(summary.pending)}</strong>
            <small>{summary.pendingCount} open payment sessions</small>
          </div>
        </article>
        <article className="payment-summary-card payment-summary-card--refunded">
          <span className="payment-summary-card__icon"><RotateCcw size={19} /></span>
          <div>
            <span>Refunded</span>
            <strong>{money(summary.refunded)}</strong>
            <small>All time</small>
          </div>
        </article>
        <article className="payment-summary-card payment-summary-card--secure">
          <span className="payment-summary-card__icon"><ShieldCheck size={19} /></span>
          <div>
            <span>Success rate</span>
            <strong>
              {summary.paidCount + summary.pendingCount
                ? Math.round((summary.paidCount / (summary.paidCount + summary.pendingCount)) * 100)
                : 0}%
            </strong>
            <small>Paid vs open sessions</small>
          </div>
        </article>
      </div>

      <section className="admin-panel payments-panel">
        <div className="admin-toolbar">
          <label className="search-box">
            <Search size={16} />
            <input type="search" placeholder="Search payment, order, transaction…" value={search} onChange={(event) => setSearch(event.target.value)} />
            {search ? <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button> : null}
          </label>
          <div className="admin-toolbar__right">
            <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter payment status">
              <option value="all">All statuses</option>
              {Object.entries(PAYMENT_STATUS).filter(([key]) => key !== "unpaid").map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </Select>
            <Select value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Filter payment method">
              <option value="all">All methods</option>
              {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <span className="admin-toolbar__count">{payments.length} payments</span>
          </div>
        </div>

        {payments.length === 0 ? (
          <EmptyState
            icon={WalletCards}
            title="No payments found"
            description="Payments will appear here as guests settle their orders."
            action={<Button variant="secondary" onClick={() => { setStatus("all"); setMethod("all"); setSearch(""); }}>Clear filters</Button>}
          />
        ) : (
          <div className="payments-table">
            <div className="payments-table__head">
              <span>Payment</span>
              <span>Order / table</span>
              <span>Method</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Created</span>
              <span>Transaction</span>
              <span />
            </div>
            {payments.map((payment) => {
              const MethodIcon = METHOD_ICONS[payment.method] || WalletCards;
              return (
                <div className="payments-row" key={payment.id}>
                  <div className="payments-row__id">
                    <strong>{payment.paymentCode}</strong>
                    <span className={`provider-tag provider-tag--${payment.provider}`}>{payment.provider}</span>
                  </div>
                  <div className="payments-row__order">
                    <a href={`/order/${payment.orderPublicToken}`} target="_blank" rel="noreferrer">
                      {payment.orderCode} <ExternalLink size={11} />
                    </a>
                    <span>{payment.tableName}</span>
                  </div>
                  <span className="payment-method">
                    <span className={`payment-method-icon payment-method-icon--${payment.method.toLowerCase()}`}><MethodIcon size={14} /></span>
                    {payment.method}
                  </span>
                  <strong className="payments-row__amount">{money(payment.amount)}</strong>
                  <span><PaymentStatusBadge status={payment.status} /></span>
                  <span className="payments-row__time">
                    <strong>{formatTime(payment.createdAt)}</strong>
                    <small>{payment.paidAt ? `Paid ${timeAgo(payment.paidAt)}` : timeAgo(payment.createdAt)}</small>
                  </span>
                  <span className="payments-row__txn">
                    {payment.transactionId ? <code title={payment.transactionId}>{payment.transactionId}</code> : <small>—</small>}
                  </span>
                  <div className="payments-row__actions">
                    {payment.status === "paid" ? (
                      <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRefundTarget(payment)}>Refund</Button>
                    ) : payment.status === "refunded" ? (
                      <span className="text-muted text-small">Refunded</span>
                    ) : (
                      <Button variant="secondary" size="sm" icon={Check} onClick={() => openCollect(payment)}>Mark paid</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="payment-footnote">
        <ShieldCheck size={15} />
        <p>Demo mode records simulated UPI confirmations. Manual payment entry is available for cash and card at the table.</p>
      </div>

      <Modal
        open={!!collectTarget}
        onClose={() => !collecting && setCollectTarget(null)}
        title="Record a manual payment"
        description={collectTarget ? `${collectTarget.paymentCode} · ${collectTarget.orderCode} · ${money(collectTarget.amount)}` : ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCollectTarget(null)} disabled={collecting}>Cancel</Button>
            <Button variant="primary" onClick={collectPayment} loading={collecting}>Confirm payment</Button>
          </>
        }
      >
        {collectTarget ? (
          <div className="collect-form">
            <div className="collect-amount">
              <span>Amount to collect</span>
              <strong>{money(collectTarget.amount)}</strong>
            </div>
            <FormField label="Payment method">
              <div className="method-options">
                {PAYMENT_METHODS.map((item) => {
                  const Icon = METHOD_ICONS[item];
                  return (
                    <button type="button" key={item} className={classNames("method-option", collectMethod === item && "is-active")} onClick={() => setCollectMethod(item)}>
                      <Icon size={18} />
                      <span>{item}</span>
                      {collectMethod === item ? <Check size={14} /> : null}
                    </button>
                  );
                })}
              </div>
            </FormField>
            <FormField label="Transaction reference" htmlFor="manual-txn" optional hint="Leave blank to generate a manual reference.">
              <input id="manual-txn" className="input" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} placeholder="e.g. CASH-1148" />
            </FormField>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!refundTarget}
        onClose={() => !refunding && setRefundTarget(null)}
        title={`Refund ${refundTarget?.paymentCode}?`}
        description="This marks the payment as refunded and updates the linked order. Gateway refunds must also be completed in your provider dashboard."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundTarget(null)} disabled={refunding}>Keep payment</Button>
            <Button variant="danger" onClick={refundPayment} loading={refunding}>Refund {refundTarget ? money(refundTarget.amount) : ""}</Button>
          </>
        }
      >
        <div className="refund-summary">
          <RotateCcw size={22} />
          <div>
            <span>Refund amount</span>
            <strong>{refundTarget ? money(refundTarget.amount) : ""}</strong>
            <small>{refundTarget?.orderCode} · {refundTarget?.tableName}</small>
          </div>
        </div>
      </Modal>
    </div>
  );
}
