import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BellRing,
  Check,
  ChefHat,
  Clock3,
  Expand,
  Flame,
  LogOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useApiQuery, useDocumentTitle, useInterval, useNow } from "../hooks/useApiQuery.js";
import { getSocket } from "../lib/socket.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { api } from "../lib/api.js";
import { classNames, elapsed, formatTime, timeAgo } from "../lib/format.js";
import { Logo } from "../components/Logo.jsx";
import { Button, IconButton, Skeleton } from "../components/ui.jsx";

const COLUMNS = [
  { status: "placed", label: "New orders", hint: "Accept to begin", icon: BellRing },
  { status: "accepted", label: "Accepted", hint: "Start cooking", icon: Check },
  { status: "preparing", label: "On the fire", hint: "In preparation", icon: Flame },
  { status: "ready", label: "Ready to serve", hint: "At the pass", icon: Sparkles },
];

const NEXT = {
  placed: { status: "accepted", label: "Accept order", icon: Check },
  accepted: { status: "preparing", label: "Start cooking", icon: Flame },
  preparing: { status: "ready", label: "Mark ready", icon: BellRing },
  ready: { status: "served", label: "Mark served", icon: UtensilsCrossed },
};

function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, ctx.currentTime + index * 0.13);
      gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + index * 0.13 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.13 + 0.28);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime + index * 0.13);
      oscillator.stop(ctx.currentTime + index * 0.13 + 0.3);
    });
    window.setTimeout(() => ctx.close(), 900);
  } catch {
    /* audio unavailable */
  }
}

function KitchenTicket({ ticket, now, onAdvance, busy }) {
  const next = NEXT[ticket.status];
  const age = (now - new Date(ticket.createdAt).getTime()) / 60_000;
  const urgency = age >= 20 ? "is-critical" : age >= 12 ? "is-warn" : "";
  return (
    <article className={classNames("kitchen-ticket", urgency)}>
      <div className="kitchen-ticket__head">
        <div className="kitchen-ticket__table">
          <span>{String(ticket.tableName).replace("Table ", "")}</span>
          <div>
            <strong>{ticket.tableName}</strong>
            <small>{ticket.orderCode}</small>
          </div>
        </div>
        <div className="kitchen-ticket__time">
          <strong>{elapsed(ticket.createdAt, now)}</strong>
          <span>{formatTime(ticket.createdAt)}</span>
        </div>
      </div>

      <div className="kitchen-ticket__items">
        {ticket.items.map((item, index) => (
          <div className="kitchen-item" key={`${item.name}-${index}`}>
            <span className="kitchen-item__qty">{item.quantity}</span>
            <span className={`kitchen-item__veg ${item.isVeg ? "is-veg" : "is-nonveg"}`}><i /></span>
            <strong>{item.name}</strong>
          </div>
        ))}
      </div>

      {ticket.notes ? (
        <div className="kitchen-ticket__note">
          <span>Note</span>
          <p>{ticket.notes}</p>
        </div>
      ) : null}

      <div className="kitchen-ticket__foot">
        <span>{ticket.itemCount} items</span>
        <button type="button" className="kitchen-ticket__action" onClick={() => onAdvance(ticket, next)} disabled={busy}>
          {next.icon ? <next.icon size={14} /> : null}
          {next.label}
          <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
}

export default function KitchenDisplay() {
  useDocumentTitle("Kitchen display");
  const { token, user, restaurant, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, refetch, refreshing } = useApiQuery("/kitchen/orders");
  const [busyId, setBusyId] = useState(null);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("smartdine.kitchen.sound") !== "off");
  const [fullscreen, setFullscreen] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [clock, setClock] = useState(new Date());
  const previousCount = useRef(null);
  const now = useNow(15_000);
  const soundRef = useRef(soundOn);

  useDocumentTitle("Kitchen display");

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const refresh = useCallback(() => refetch({ silent: true }), [refetch]);

  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return undefined;
    const onCreated = () => {
      refresh();
      if (soundRef.current) playChime();
    };
    const onUpdated = () => refresh();
    socket.on("order:created", onCreated);
    socket.on("order:updated", onUpdated);
    socket.on("payment:updated", onUpdated);
    socket.on("connect", refresh);
    return () => {
      socket.off("order:created", onCreated);
      socket.off("order:updated", onUpdated);
      socket.off("payment:updated", onUpdated);
      socket.off("connect", refresh);
    };
  }, [token, refresh]);

  useEffect(() => {
    if (!data) return;
    const total = data.tickets.length;
    if (previousCount.current !== null && total > previousCount.current && soundOn) playChime();
    previousCount.current = total;
  }, [data, soundOn]);

  useInterval(refresh, 30_000);
  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("smartdine.kitchen.sound", next ? "on" : "off");
    if (next) playChime();
    toast.info(next ? "New-order sound enabled." : "New-order sound muted.");
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      toast.error("Your browser blocked fullscreen mode.");
    }
  }

  async function advance(ticket, next) {
    if (!next) return;
    setBusyId(ticket.id);
    try {
      await api(`/kitchen/orders/${ticket.id}/status`, { method: "PATCH", body: { status: next.status } });
      toast.success(`${ticket.orderCode} · ${next.label.toLowerCase()}`);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function signOut() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  const grouped = useMemo(() => {
    const map = { placed: [], accepted: [], preparing: [], ready: [] };
    for (const ticket of data?.tickets || []) {
      if (map[ticket.status]) map[ticket.status].push(ticket);
    }
    return map;
  }, [data]);

  const total = data?.tickets?.length || 0;
  const oldest = data?.tickets?.length
    ? data.tickets.reduce((max, ticket) => (new Date(ticket.createdAt) < new Date(max.createdAt) ? ticket : max), data.tickets[0])
    : null;

  return (
    <div className="kitchen-shell">
      <header className="kitchen-header">
        <div className="kitchen-header__brand">
          <Logo size={38} />
          <div>
            <strong>SmartDine <span>/ Kitchen</span></strong>
            <small>{restaurant?.name || "Spice Route"} · live pass</small>
          </div>
        </div>

        <div className="kitchen-header__summary">
          <div><strong>{data?.summary?.new ?? 0}</strong><span>New</span></div>
          <div><strong>{data?.summary?.preparing ?? 0}</strong><span>In prep</span></div>
          <div><strong>{data?.summary?.ready ?? 0}</strong><span>Ready</span></div>
          <div className="kitchen-header__divider" />
          <div className="kitchen-header__clock">
            <strong>{clock.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</strong>
            <span>{clock.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
        </div>

        <div className="kitchen-header__actions">
          <span className="kitchen-live"><span className="live-dot" /> Live</span>
          <IconButton label={soundOn ? "Mute new-order sound" : "Enable new-order sound"} onClick={toggleSound} className={classNames("kitchen-icon-button", soundOn && "is-on")}>
            {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconButton>
          <IconButton label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullscreen} className="kitchen-icon-button">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </IconButton>
          <IconButton label="Refresh tickets" onClick={refresh} className="kitchen-icon-button">
            <RefreshCw size={18} className={refreshing ? "spin" : ""} />
          </IconButton>
          {user?.role === "admin" ? (
            <Link to="/admin" className="kitchen-admin-link"><ChefHat size={15} /> Admin</Link>
          ) : null}
          <IconButton label="Sign out" onClick={signOut} className="kitchen-icon-button">
            <LogOut size={18} />
          </IconButton>
        </div>
      </header>

      <div className="kitchen-statusbar">
        <span><span className="live-dot" /> Service in progress</span>
        <span>{total === 0 ? "The pass is clear" : `${total} open ticket${total === 1 ? "" : "s"}`}</span>
        {oldest ? <span><Clock3 size={13} /> Oldest ticket {timeAgo(oldest.createdAt)}</span> : null}
        <span className="kitchen-statusbar__right"><ShieldCheck size={13} /> Updates in real time</span>
      </div>

      <main className="kitchen-board">
        {loading ? (
          <div className="kitchen-loading">
            {COLUMNS.map((column) => (
              <div className="kitchen-column" key={column.status}>
                <Skeleton height={48} radius={10} />
                <Skeleton height={220} radius={14} />
                <Skeleton height={180} radius={14} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="kitchen-error">
            <span><ChefHat size={26} /></span>
            <h2>We couldn't load the kitchen board</h2>
            <p>{error.message}</p>
            <Button variant="light" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : total === 0 ? (
          <div className="kitchen-empty">
            <span className="kitchen-empty__icon"><UtensilsCrossed size={34} /></span>
            <span className="eyebrow">All caught up</span>
            <h2>The pass is clear.</h2>
            <p>New orders will appear here instantly, with a gentle chime if sound is on.</p>
            <div className="kitchen-empty__hint">
              <span><span className="live-dot" /> Listening for orders</span>
              <button type="button" onClick={refresh}>Refresh now</button>
            </div>
          </div>
        ) : (
          COLUMNS.map((column) => {
            const Icon = column.icon;
            const tickets = grouped[column.status] || [];
            return (
              <section className={`kitchen-column kitchen-column--${column.status}`} key={column.status}>
                <header className="kitchen-column__head">
                  <div>
                    <span className="kitchen-column__icon"><Icon size={16} /></span>
                    <div>
                      <h2>{column.label}</h2>
                      <p>{column.hint}</p>
                    </div>
                  </div>
                  <span className="kitchen-column__count">{tickets.length}</span>
                </header>
                <div className="kitchen-column__body">
                  {tickets.length === 0 ? (
                    <div className="kitchen-column__empty">
                      <Check size={18} />
                      <span>Nothing here</span>
                    </div>
                  ) : (
                    tickets.map((ticket) => (
                      <KitchenTicket
                        ticket={ticket}
                        now={now}
                        key={ticket.id}
                        onAdvance={advance}
                        busy={busyId === ticket.id}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>

      <footer className="kitchen-footer">
        <span>SmartDine Kitchen Display · {restaurant?.name || "Spice Route"}</span>
        <span>Tap a ticket action to advance the order · Sound {soundOn ? "on" : "muted"}</span>
      </footer>
    </div>
  );
}
