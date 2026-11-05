import { Badge } from "./ui.jsx";
import { ORDER_STATUS, PAYMENT_STATUS, TABLE_STATUS } from "../lib/format.js";

export function OrderStatusBadge({ status, dot = true }) {
  const meta = ORDER_STATUS[status] || { label: status || "Unknown", tone: "slate" };
  return (
    <Badge tone={meta.tone} dot={dot}>
      {meta.label}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, dot = false }) {
  const meta = PAYMENT_STATUS[status] || { label: status || "Unknown", tone: "slate" };
  return (
    <Badge tone={meta.tone} dot={dot}>
      {meta.label}
    </Badge>
  );
}

export function TableStatusBadge({ status, dot = true }) {
  const meta = TABLE_STATUS[status] || { label: status || "Unknown", tone: "slate" };
  return (
    <Badge tone={meta.tone} dot={dot}>
      {meta.label}
    </Badge>
  );
}
