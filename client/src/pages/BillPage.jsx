import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clock3, Download, Mail, MapPin, Phone, Printer, ReceiptText } from "lucide-react";
import { useApiQuery, useDocumentTitle } from "../hooks/useApiQuery.js";
import { formatDate, formatDateTime, formatTime, money } from "../lib/format.js";
import { Logo } from "../components/Logo.jsx";
import { Button, ErrorState, Skeleton, VegMark } from "../components/ui.jsx";
import { PaymentStatusBadge } from "../components/StatusBadge.jsx";

export default function BillPage() {
  const { orderToken } = useParams();
  const { data, error, loading, refetch } = useApiQuery(`/public/bill/${orderToken}`);
  useDocumentTitle(data?.orderCode ? `Bill ${data.orderCode}` : "Digital bill");

  if (loading) {
    return (
      <div className="customer-page invoice-page">
        <div className="invoice-loading">
          <Skeleton width={220} height={24} />
          <Skeleton height={520} radius={18} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-error-page">
        <Logo withWordmark size={40} />
        <ErrorState title="We couldn't load this bill" message={error.message} onRetry={refetch} />
        <Link to="/" className="text-link">
          <ArrowLeft size={15} /> Back to SmartDine
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { restaurant, payment } = data;
  const isPaid = data.paymentStatus === "paid";
  const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="customer-page invoice-page">
      <div className="invoice-toolbar">
        <Link to={`/order/${data.publicToken}`} className="button button--ghost button--sm">
          <ArrowLeft size={15} /> Back to order
        </Link>
        <div className="invoice-toolbar__actions">
          <span className="invoice-toolbar__hint">Use your browser's print dialog to save as PDF.</span>
          <Button variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
      </div>

      <main className="invoice" id="invoice">
        <div className="invoice__top">
          <div className="invoice__brand">
            <Logo size={48} />
            <div>
              <h1>{restaurant.name}</h1>
              <p>{restaurant.tagline}</p>
            </div>
          </div>
          <div className="invoice__badge">
            <span>Tax invoice</span>
            <strong>{data.invoiceNumber}</strong>
            <PaymentStatusBadge status={data.paymentStatus} />
          </div>
        </div>

        <div className="invoice__meta-grid">
          <div className="invoice__meta">
            <span>Billed to</span>
            <strong>{data.table.name}</strong>
            <p>Dine-in · Table {data.table.number}</p>
            <p>Order {data.orderCode}</p>
          </div>
          <div className="invoice__meta">
            <span>Invoice date</span>
            <strong>{formatDate(data.generatedAt)}</strong>
            <p>Placed at {formatTime(data.createdAt)}</p>
            <p>Order status: {data.status}</p>
          </div>
          <div className="invoice__meta">
            <span>From</span>
            <strong>{restaurant.name}</strong>
            <p>{restaurant.address}</p>
            <p>GSTIN {restaurant.gstin || "—"}</p>
          </div>
        </div>

        <div className="invoice__items">
          <div className="invoice-items-head">
            <span>#</span>
            <span>Item</span>
            <span>Qty</span>
            <span>Rate</span>
            <span>Amount</span>
          </div>
          {data.items.map((item, index) => (
            <div className="invoice-item" key={`${item.name}-${index}`}>
              <span className="invoice-item__index">{String(index + 1).padStart(2, "0")}</span>
              <span className="invoice-item__name">
                <VegMark isVeg={item.isVeg} size="sm" />
                {item.name}
              </span>
              <span>{item.quantity}</span>
              <span>{money(item.price, restaurant.currency)}</span>
              <strong>{money(item.lineTotal, restaurant.currency)}</strong>
            </div>
          ))}
        </div>

        <div className="invoice__bottom">
          <div className="invoice__notes">
            <ReceiptText size={17} />
            <div>
              <strong>Order notes</strong>
              <p>{data.notes || "No special instructions."}</p>
            </div>
            <div className="invoice__contact">
              <span>
                <MapPin size={12} /> {restaurant.address}
              </span>
              <span>
                <Phone size={12} /> {restaurant.phone}
              </span>
            </div>
          </div>

          <div className="invoice__totals">
            <div>
              <span>Subtotal ({totalItems} items)</span>
              <span>{money(data.subtotal, restaurant.currency)}</span>
            </div>
            <div>
              <span>GST @ {restaurant.taxPercent}%</span>
              <span>{money(data.tax, restaurant.currency)}</span>
            </div>
            {data.serviceCharge > 0 ? (
              <div>
                <span>Service charge</span>
                <span>{money(data.serviceCharge, restaurant.currency)}</span>
              </div>
            ) : null}
            <div className="invoice__grand-total">
              <span>Total</span>
              <strong>{money(data.total, restaurant.currency)}</strong>
            </div>
            {isPaid && payment ? (
              <div className="invoice__paid">
                <span className="invoice__paid-check">
                  <Check size={14} />
                </span>
                <div>
                  <strong>Paid via {payment.method || "UPI"}</strong>
                  <span>{payment.transactionId || payment.paymentCode}</span>
                  <span>{payment.paidAt ? formatDateTime(payment.paidAt) : ""}</span>
                </div>
              </div>
            ) : (
              <div className="invoice__unpaid">
                <Clock3 size={15} /> Payment pending · {money(data.total, restaurant.currency)} due
              </div>
            )}
          </div>
        </div>

        {isPaid ? <span className="invoice__stamp">PAID</span> : null}

        <div className="invoice__footer">
          <p>Thank you for dining with us. We hope to see you again soon.</p>
          <span>
            This is a computer-generated invoice. For questions, contact {restaurant.email || restaurant.phone}.
          </span>
          <div className="invoice__footer-brand">
            <Logo size={20} /> SmartDine · Double QR dining
          </div>
        </div>
      </main>

      <div className="invoice-actions-mobile">
        <Button variant="primary" size="md" fullWidth icon={Download} onClick={() => window.print()}>
          Save or print bill
        </Button>
      </div>
    </div>
  );
}
