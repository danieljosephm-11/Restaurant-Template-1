import { createPortal } from "react-dom";
import { useEffect } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, X } from "lucide-react";
import { classNames } from "../lib/format.js";

export function Spinner({ size = 20, className = "" }) {
  return <Loader2 size={size} className={classNames("spin", className)} aria-hidden="true" />;
}

export function PageLoader({ label = "Setting the table…" }) {
  return (
    <div className="page-loader">
      <span className="page-loader__mark">SD</span>
      <Spinner size={22} />
      <p>{label}</p>
    </div>
  );
}

export function InlineLoader({ label = "Loading…" }) {
  return (
    <span className="inline-loader">
      <Spinner size={17} />
      {label}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  icon: Icon,
  fullWidth = false,
  ...props
}) {
  return (
    <button
      type="button"
      className={classNames(
        "button",
        `button--${variant}`,
        `button--${size}`,
        fullWidth && "button--full",
        loading && "is-loading",
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner size={size === "sm" ? 15 : 18} /> : Icon ? <Icon size={size === "sm" ? 15 : 18} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({ children, label, variant = "ghost", size = "md", className = "", ...props }) {
  return (
    <button
      type="button"
      className={classNames("icon-button", `icon-button--${variant}`, `icon-button--${size}`, className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "slate", dot = false, className = "" }) {
  return (
    <span className={classNames("badge", `badge--${tone}`, className)}>
      {dot ? <span className="badge__dot" /> : null}
      {children}
    </span>
  );
}

export function VegMark({ isVeg = true, size = "md" }) {
  return (
    <span
      className={classNames("veg-mark", `veg-mark--${size}`, isVeg ? "is-veg" : "is-nonveg")}
      title={isVeg ? "Vegetarian" : "Contains meat"}
      aria-label={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span />
    </span>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={classNames("toggle", disabled && "is-disabled")}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange?.(event.target.checked)}
        disabled={disabled}
      />
      <span className="toggle__track">
        <span className="toggle__thumb" />
      </span>
      {label ? <span className="toggle__label">{label}</span> : null}
    </label>
  );
}

export function FormField({ label, hint, error, htmlFor, children, optional = false, className = "" }) {
  return (
    <div className={classNames("form-field", error && "has-error", className)}>
      {label ? (
        <label className="form-label" htmlFor={htmlFor}>
          {label}
          {optional ? <span className="form-label__optional">Optional</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="form-error">{error}</p> : hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}

export function Select({ children, className = "", ...props }) {
  return (
    <span className={classNames("select-wrap", className)}>
      <select className="input select" {...props}>
        {children}
      </select>
      <ChevronDown size={16} className="select-wrap__icon" />
    </span>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = "md", className = "" }) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-layer">
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close dialog" />
      <div className={classNames("modal", `modal--${size}`, className)} role="dialog" aria-modal="true">
        <div className="modal__head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={19} />
          </IconButton>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={classNames("confirm-illustration", `confirm-illustration--${tone}`)}>
        <AlertTriangle size={24} />
      </div>
    </Modal>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={classNames("empty-state", className)}>
      {Icon ? (
        <span className="empty-state__icon">
          <Icon size={23} />
        </span>
      ) : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = "Something went astray" }) {
  return (
    <div className="error-state">
      <span className="error-state__icon">
        <AlertTriangle size={22} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ width, height = 16, radius = 8, className = "" }) {
  return (
    <span
      className={classNames("skeleton", className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton height={190} radius={16} />
      <Skeleton width="65%" height={20} />
      <Skeleton width="90%" height={13} />
      <Skeleton width="45%" height={13} />
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 20, size = "md", label }) {
  return (
    <div className={classNames("stepper", `stepper--${size}`)} role="group" aria-label={label || "Quantity"}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease quantity">
        −
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}

export function CheckLine({ children, checked = false }) {
  return (
    <span className={classNames("check-line", checked && "is-checked")}>
      <span className="check-line__box">{checked ? <Check size={12} /> : null}</span>
      {children}
    </span>
  );
}

export function CopyButton({ value, label = "Copy", className = "" }) {
  return (
    <button
      type="button"
      className={classNames("copy-button", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          const el = document.activeElement;
          if (el) el.blur();
        } catch {
          /* ignore */
        }
      }}
      title={label}
    >
      {label}
    </button>
  );
}
