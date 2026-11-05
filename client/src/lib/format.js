export function money(value, currency = "INR") {
  const number = Number(value) || 0;
  const hasPaise = Math.round(number * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(number);
}

export function compactNumber(value) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

export function formatTime(dateLike) {
  if (!dateLike) return "—";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function formatDate(dateLike, options = {}) {
  if (!dateLike) return "—";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...options });
}

export function formatDateTime(dateLike) {
  if (!dateLike) return "—";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date)} · ${formatTime(date)}`;
}

export function timeAgo(dateLike, now = Date.now()) {
  if (!dateLike) return "—";
  const diff = Math.max(0, now - new Date(dateLike).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateLike);
}

export function elapsed(minutesOrDate, now = Date.now()) {
  const diff =
    typeof minutesOrDate === "number"
      ? minutesOrDate * 60_000
      : Math.max(0, now - new Date(minutesOrDate).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export const ORDER_STATUS = {
  placed: { label: "New order", tone: "amber", description: "Sent to the kitchen" },
  accepted: { label: "Accepted", tone: "blue", description: "The kitchen has started" },
  preparing: { label: "Preparing", tone: "orange", description: "Your food is being prepared" },
  ready: { label: "Ready", tone: "green", description: "Ready to be served" },
  served: { label: "Served", tone: "slate", description: "Enjoy your meal" },
  cancelled: { label: "Cancelled", tone: "red", description: "This order was cancelled" },
};

export const PAYMENT_STATUS = {
  unpaid: { label: "Unpaid", tone: "red" },
  pending: { label: "Payment pending", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  refunded: { label: "Refunded", tone: "slate" },
  expired: { label: "Expired", tone: "slate" },
};

export const TABLE_STATUS = {
  available: { label: "Available", tone: "green" },
  occupied: { label: "Occupied", tone: "amber" },
  reserved: { label: "Reserved", tone: "blue" },
  inactive: { label: "Out of service", tone: "slate" },
};

export const PAYMENT_METHODS = ["UPI", "CARD", "CASH"];

export const ORDER_STATUS_FLOW = ["placed", "accepted", "preparing", "ready", "served"];

export const NEXT_ORDER_STATUS = {
  placed: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "served",
};

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function upiDisplay(uri) {
  if (!uri) return "";
  try {
    const parsed = new URL(uri);
    return parsed.searchParams.get("pa") || "";
  } catch {
    return "";
  }
}
