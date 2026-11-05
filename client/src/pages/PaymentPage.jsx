import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  LockKeyhole,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TimerOff,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
import { useApiQuery, useDocumentTitle, useInterval } from "../hooks/useApiQuery.js";
import { formatDateTime, formatTime, money, upiDisplay } from "../lib/format.js";
import { api } from "../lib/api.js";
import { getSocket, watchPayment } from "../lib/socket.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { Logo } from "../components/Logo.jsx";
import { Badge, Button, ErrorState, Skeleton, Spinner, VegMark } from "../components/ui.jsx";

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("razorpay-checkout-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay));
      existing.addEventListener("error", () => reject(new Error("Could not load the payment gateway.")));
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-script";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Could not load the payment gateway."));
    document.body.appendChild(script);
  });
}

function useCountdown(expiresAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => {
    if (!expiresAt) return { expired: false, label: "" };
    const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
    const minutes = Math.floor(remaining / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return {
      expired: remaining <= 0,
      label: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    };
  }, [expiresAt, now]);
}

export default function PaymentPage() {
  const { sessionToken } = useParams();
  const { token: authToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, error, loading, refetch } = useApiQuery(`/public/payments/${sessionToken}`);
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useDocumentTitle(data?.order?.orderCode ? `Pay ${data.order.orderCode}` : "Secure payment");

  const refresh = useCallback(() => {
    refetch({ silent: true });
  }, [refetch]);

  useEffect(() => {
    const socket = getSocket(authToken);
    if (!socket) return undefined;
    const unwatch = watchPayment(socket, sessionToken);
    const onUpdate = () => refresh();
    socket.on("payment:updated", onUpdate);
    return () => {
      unwatch();
      socket.off("payment:updated", onUpdate);
    };
  }, [authToken, sessionToken, refresh]);

  const status = data?.status;
  useInterval(refresh, status === "pending" ? 6000 : 0);
  const countdown = useCountdown(data?.status === "pending" ? data.expiresAt : null);

  async function confirmDemo() {
    setConfirming(true);
    try {
      await api(`/public/payments/${sessionToken}/confirm`, { method: "POST", body: {} });
      await refetch({ silent: true });
      toast.success("Demo payment confirmed. Your order is marked paid.");
    } catch (err) {
      toast.error(err.message);
      refresh();
    } finally {
      setConfirming(false);
    }
  }

  async function startNewSession() {
    if (!data?.order?.publicToken) return;
    setCreating(true);
    try {
      const session = await api(`/public/orders/${data.order.publicToken}/payment-session`, {
        method: "POST",
        body: {},
      });
      navigate(`/payment/${session.sessionToken}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function payWithRazorpay() {
    if (!data?.razorpay) return;
    setGatewayLoading(true);
    try {
      const Razorpay = await loadRazorpay();
      const checkout = new Razorpay({
        key: data.razorpay.keyId,
        amount: Math.round(data.razorpay.amount * 100),
        currency: data.currency || "INR",
        name: data.razorpay.name,
        description: data.razorpay.description,
        order_id: data.razorpay.orderId,
        theme: { color: "#173d2c" },
        handler: () => {
          toast.success("Payment submitted. Confirming with the gateway…");
          refresh();
          window.setTimeout(refresh, 2500);
        },
        modal: {
          ondismiss: () => setGatewayLoading(false),
        },
      });
      checkout.open();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGatewayLoading(false);
    }
  }

  async function copyUpi() {
    const vpa = upiDisplay(data?.upiUri);
    if (!vpa) return;
    try {
      await navigator.clipboard.writeText(vpa);
      setCopied(true);
      toast.info("UPI ID copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy automatically.");
    }
  }

  if (loading) {
    return (
      <div className="customer-page payment-page">
        <div className="payment-loading">
          <Skeleton width={160} height={18} />
          <Skeleton width={420} height={50} />
          <div className="payment-loading__grid">
            <Skeleton height={460} radius={22} />
            <Skeleton height={360} radius={22} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-error-page">
        <Logo withWordmark size={40} />
        <ErrorState title="This payment link isn't available" message={error.message} onRetry={refetch} />
        <Link to="/" className="text-link">
          <ArrowLeft size={15} /> Back to SmartDine
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { order, restaurant } = data;
  const paid = status === "paid";
  const expired = status === "expired" || status === "failed" || (status === "pending" && countdown.expired);
  const isDemo = data.mode === "demo";

  if (paid) {
    return (
      <div className="customer-page payment-success-page">
        <header className="customer-header customer-header--slim">
          <div className="customer-header__inner">
            <Link to="/" className="customer-header__brand" aria-label="SmartDine home">
              <Logo size={36} />
              <span>
                <strong>{restaurant.name}</strong>
                <small>Payment receipt</small>
              </span>
            </Link>
            <span className="table-pill">
              <span className="table-pill__dot" />
              {order.table?.name}
            </span>
          </div>
        </header>

        <main className="payment-success">
          <div className="payment-success__confetti" aria-hidden="true">
            {Array.from({ length: 14 }).map((_, index) => (
              <span key={index} style={{ "--i": index }} />
            ))}
          </div>
          <span className="payment-success__check">
            <Check size={38} />
          </span>
          <span className="eyebrow eyebrow--plain">Payment complete</span>
          <h1>
            Thank you, <em>settled.</em>
          </h1>
          <p className="payment-success__lede">
            {money(data.amount, restaurant.currency)} paid for {order.orderCode}. Your receipt is ready.
          </p>
          <div className="payment-success__card">
            <div>
              <span>Amount paid</span>
              <strong>{money(data.amount, restaurant.currency)}</strong>
            </div>
            <div>
              <span>Method</span>
              <strong>{data.method || "UPI"}</strong>
            </div>
            <div>
              <span>Payment ID</span>
              <strong className="mono">{data.transactionId || data.paymentCode}</strong>
            </div>
            <div>
              <span>Paid on</span>
              <strong>{formatDateTime(data.paidAt || new Date())}</strong>
            </div>
          </div>
          {isDemo ? (
            <span className="demo-pill">
              <Sparkles size={13} /> Demo mode — no real money was charged
            </span>
          ) : null}
          <div className="payment-success__actions">
            <Link to={`/bill/${order.publicToken}`} className="button button--primary button--lg">
              <FileText size={17} /> View digital bill
            </Link>
            <Link to={`/order/${order.publicToken}`} className="button button--secondary button--lg">
              Track your order <ArrowRight size={16} />
            </Link>
          </div>
          <Link to="/" className="back-link">
            <ArrowLeft size={15} /> SmartDine home
          </Link>
        </main>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="customer-page payment-page">
        <header className="customer-header customer-header--slim">
          <div className="customer-header__inner">
            <Link to="/" className="customer-header__brand" aria-label="SmartDine home">
              <Logo size={36} />
              <span>
                <strong>{restaurant.name}</strong>
                <small>Secure payment</small>
              </span>
            </Link>
            <span className="table-pill">
              <span className="table-pill__dot" />
              {order.table?.name}
            </span>
          </div>
        </header>
        <main className="payment-expired">
          <span className="payment-expired__icon">
            <TimerOff size={28} />
          </span>
          <span className="eyebrow eyebrow--plain">Session {status === "failed" ? "failed" : "expired"}</span>
          <h1>This payment link has timed out.</h1>
          <p>
            For your security, payment links are only valid for 15 minutes. No money has been taken. Create a fresh
            link for {order.orderCode} to try again.
          </p>
          <div className="payment-expired__amount">
            <span>Order total</span>
            <strong>{money(data.amount, restaurant.currency)}</strong>
          </div>
          <Button variant="primary" size="lg" icon={RefreshCw} onClick={startNewSession} loading={creating}>
            Create a new payment link
          </Button>
          <Link to={`/order/${order.publicToken}`} className="text-link">
            Back to order
          </Link>
        </main>
      </div>
    );
  }

  const razorpayReady = data.mode === "razorpay" && data.razorpay;

  return (
    <div className="customer-page payment-page">
      <header className="customer-header customer-header--slim">
        <div className="customer-header__inner">
          <Link to="/" className="customer-header__brand" aria-label="SmartDine home">
            <Logo size={36} />
            <span>
              <strong>{restaurant.name}</strong>
              <small>Secure payment</small>
            </span>
          </Link>
          <div className="payment-head">
            <span className="table-pill">
              <span className="table-pill__dot" />
              {order.table?.name}
            </span>
            <span className="secure-pill">
              <LockKeyhole size={13} /> Encrypted
            </span>
          </div>
        </div>
      </header>

      <main className="payment-main">
        <div className="payment-main__top">
          <div>
            <span className="eyebrow eyebrow--plain">
              <span className="eyebrow__spark">✦</span> Order {order.orderCode} · Payment {data.paymentCode}
            </span>
            <h1>
              Complete your <em>payment.</em>
            </h1>
            <p>Scan with any UPI app or use the secure button below. This link is unique to your order.</p>
          </div>
          <div className="payment-amount-hero">
            <span>Amount due</span>
            <strong>{money(data.amount, restaurant.currency)}</strong>
            <Badge tone={countdown.expired ? "red" : "amber"}>
              <Clock3 size={12} /> {countdown.label} left
            </Badge>
          </div>
        </div>

        <div className="payment-grid">
          <section className="payment-card panel">
            <div className="payment-card__head">
              <div>
                <span className="panel__eyebrow">Pay with UPI</span>
                <h2>Scan to pay</h2>
              </div>
              <span className="payment-card__brand">
                <WalletCards size={17} /> UPI
              </span>
            </div>

            {isDemo ? (
              <div className="demo-banner">
                <span className="demo-banner__icon">
                  <Sparkles size={17} />
                </span>
                <div>
                  <strong>Demo mode</strong>
                  <p>
                    This is a simulated payment experience. The QR code is a real UPI intent, but the merchant ID is a
                    demo. Use the button below to simulate a successful payment.
                  </p>
                </div>
              </div>
            ) : (
              <div className="live-banner">
                <ShieldCheck size={16} /> Live gateway mode · payments are verified server-side.
              </div>
            )}

            <div className="payment-qr-wrap">
              <div className="payment-qr">
                <img src={data.qrUrl} alt={`UPI QR code for ${money(data.amount)}`} />
                <span className="payment-qr__corner payment-qr__corner--tl" />
                <span className="payment-qr__corner payment-qr__corner--tr" />
                <span className="payment-qr__corner payment-qr__corner--bl" />
                <span className="payment-qr__corner payment-qr__corner--br" />
              </div>
              <div className="payment-qr-side">
                <span className="payment-qr-side__eyebrow">Scan with</span>
                <div className="upi-apps">
                  <span>GPay</span>
                  <span>PhonePe</span>
                  <span>Paytm</span>
                  <span>BHIM</span>
                </div>
                <div className="payment-vpa">
                  <span>UPI ID</span>
                  <strong>{upiDisplay(data.upiUri) || "Not configured"}</strong>
                  <button type="button" onClick={copyUpi} className="copy-button">
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="payment-ref">
                  <span>Payment reference</span>
                  <strong className="mono">{data.paymentCode}</strong>
                </div>
                {data.upiUri ? (
                  <a href={data.upiUri} className="button button--ghost button--sm button--full">
                    <Smartphone size={15} /> Open UPI app
                  </a>
                ) : null}
              </div>
            </div>

            <div className="payment-divider">
              <span>or</span>
            </div>

            {isDemo ? (
              <div className="demo-confirm">
                <Button variant="primary" size="lg" fullWidth icon={ShieldCheck} onClick={confirmDemo} loading={confirming}>
                  Simulate successful payment
                </Button>
                <p>
                  This bypasses the real gateway for demonstration. In live mode this action is disabled and payment is
                  confirmed by server-verified webhook.
                </p>
              </div>
            ) : razorpayReady ? (
              <Button
                variant="primary"
                size="lg"
                fullWidth
                icon={CreditCard}
                onClick={payWithRazorpay}
                loading={gatewayLoading}
              >
                Pay {money(data.amount, restaurant.currency)} securely
              </Button>
            ) : (
              <div className="payment-unavailable">
                <TriangleAlert size={17} /> Card payment is not configured. Please use UPI or pay at the counter.
              </div>
            )}

            <div className="payment-trust">
              <span>
                <ShieldCheck size={14} /> Server-verified amount
              </span>
              <span>
                <LockKeyhole size={14} /> PCI-compliant gateway
              </span>
              <span>
                <RefreshCw size={14} /> Duplicate-safe
              </span>
            </div>
          </section>

          <aside className="payment-summary">
            <section className="panel">
              <div className="panel__head">
                <div>
                  <span className="panel__eyebrow">Order summary</span>
                  <h2>{order.orderCode}</h2>
                </div>
                <ReceiptText size={19} className="panel__icon" />
              </div>
              <div className="payment-order-meta">
                <span>
                  Placed {formatTime(order.createdAt)} · {order.table?.name}
                </span>
                <Badge tone="amber" dot>
                  Awaiting payment
                </Badge>
              </div>
              <div className="payment-items">
                {order.items.map((item, index) => (
                  <div className="payment-item" key={`${item.name}-${index}`}>
                    <span className="payment-item__qty">{item.quantity}×</span>
                    <div>
                      <VegMark isVeg={item.isVeg} size="sm" />
                      <strong>{item.name}</strong>
                    </div>
                    <span>{money(item.lineTotal, restaurant.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="bill-lines payment-bill-lines">
                <div>
                  <span>Subtotal</span>
                  <span>{money(order.subtotal, restaurant.currency)}</span>
                </div>
                <div>
                  <span>GST ({restaurant.taxPercent}%)</span>
                  <span>{money(order.tax, restaurant.currency)}</span>
                </div>
                {order.serviceCharge > 0 ? (
                  <div>
                    <span>Service charge</span>
                    <span>{money(order.serviceCharge, restaurant.currency)}</span>
                  </div>
                ) : null}
                <div className="bill-lines__total">
                  <span>Amount due</span>
                  <strong>{money(order.total, restaurant.currency)}</strong>
                </div>
              </div>
            </section>

            <div className="aside-card aside-card--how">
              <span className="aside-card__eyebrow">Payment protection</span>
              <ul className="payment-protection">
                <li>
                  <Check size={14} />
                  <span>Every link is tied to one order and expires in 15 minutes.</span>
                </li>
                <li>
                  <Check size={14} />
                  <span>The amount is calculated on our server, not in your browser.</span>
                </li>
                <li>
                  <Check size={14} />
                  <span>Once paid, duplicate payment attempts are automatically blocked.</span>
                </li>
                <li>
                  <Check size={14} />
                  <span>{isDemo ? "Demo payments never touch real money." : "Gateway signatures are verified before marking paid."}</span>
                </li>
              </ul>
            </div>

            <div className="payment-summary__footer">
              <Link to={`/order/${order.publicToken}`} className="text-link">
                <ArrowLeft size={14} /> Back to order
              </Link>
              <span>
                <QrCode size={14} /> Dynamic QR #{data.paymentCode}
              </span>
            </div>
          </aside>
        </div>

        <div className="payment-help">
          <Clock3 size={16} />
          <p>
            Having trouble? Keep this page open — payment status updates automatically. You can also show payment{" "}
            <strong>{data.paymentCode}</strong> to our team.
          </p>
          <a href={`tel:${restaurant.phone}`}>
            Call {restaurant.phone} <ExternalLink size={13} />
          </a>
        </div>
      </main>

      <footer className="customer-footer">
        <p>{restaurant.name} · {restaurant.address}</p>
        <span>
          <Logo size={20} /> SmartDine secure payments
        </span>
      </footer>
    </div>
  );
}
