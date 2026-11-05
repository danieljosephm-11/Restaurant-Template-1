import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, type = "success", options = {}) => {
      const id = ++idRef.current;
      setToasts((current) => [...current.slice(-3), { id, message, type, title: options.title }]);
      if (options.duration !== 0) {
        window.setTimeout(() => dismiss(id), options.duration || 4200);
      }
      return id;
    },
    [dismiss]
  );

  const toast = useMemo(
    () => ({
      success: (message, options) => push(message, "success", options),
      error: (message, options) => push(message, "error", options),
      info: (message, options) => push(message, "info", options),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((item) => {
          const Icon = ICONS[item.type] || Info;
          return (
            <div className={`toast toast--${item.type}`} key={item.id}>
              <span className="toast__icon">
                <Icon size={18} />
              </span>
              <div className="toast__body">
                {item.title ? <strong>{item.title}</strong> : null}
                <span>{item.message}</span>
              </div>
              <button type="button" className="icon-button icon-button--small" onClick={() => dismiss(item.id)} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
