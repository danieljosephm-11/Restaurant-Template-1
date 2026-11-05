import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChefHat,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  Table2,
  WalletCards,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { getSocket } from "../lib/socket.js";
import { Logo } from "./Logo.jsx";
import { IconButton } from "./ui.jsx";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/menu", label: "Menu", icon: BookOpen },
  { to: "/admin/tables", label: "Tables & QR", icon: Table2 },
  { to: "/admin/payments", label: "Payments", icon: WalletCards },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const TITLES = {
  "/admin": "Overview",
  "/admin/orders": "Orders",
  "/admin/menu": "Menu manager",
  "/admin/tables": "Tables & QR codes",
  "/admin/payments": "Payments",
  "/admin/reports": "Reports",
  "/admin/settings": "Settings",
};

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function AdminLayout() {
  const { user, restaurant, token, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (token) getSocket(token);
  }, [token]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function signOut() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-shell">
      {mobileOpen ? (
        <button type="button" className="admin-scrim" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
      ) : null}

      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="admin-sidebar__brand">
          <Link to="/admin">
            <Logo size={36} />
            <span>
              <strong>SmartDine</strong>
              <small>Operations</small>
            </span>
          </Link>
          <IconButton label="Close menu" className="admin-sidebar__close" onClick={() => setMobileOpen(false)}>
            <X size={19} />
          </IconButton>
        </div>

        <div className="admin-sidebar__restaurant">
          <span className="admin-sidebar__restaurant-mark">{initials(restaurant?.name || "Spice Route")}</span>
          <div>
            <strong>{restaurant?.name || "Spice Route"}</strong>
            <span>{restaurant?.tagline || "Restaurant workspace"}</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          <span className="admin-nav__label">Workspace</span>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `admin-nav__link ${isActive ? "is-active" : ""}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                <span className="admin-nav__chevron">
                  <ChevronLeft size={14} />
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-sidebar__utility">
          <NavLink to="/kitchen" className="admin-utility-link">
            <ChefHat size={17} />
            <span>Kitchen display</span>
            <ExternalLink size={13} />
          </NavLink>
          <a href="/" target="_blank" rel="noreferrer" className="admin-utility-link">
            <QrCode size={17} />
            <span>Guest site</span>
            <ExternalLink size={13} />
          </a>
        </div>

        <div className="admin-sidebar__footer">
          <div className="admin-sidebar__live">
            <span className="live-dot" />
            <div>
              <strong>System live</strong>
              <span>Demo payments enabled</span>
            </div>
          </div>
          <div className="admin-user">
            <span className="admin-user__avatar">{initials(user?.name)}</span>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            <IconButton label="Sign out" onClick={signOut}>
              <LogOut size={16} />
            </IconButton>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <IconButton label="Open menu" className="admin-topbar__burger" onClick={() => setMobileOpen(true)}>
              <Menu size={21} />
            </IconButton>
            <div>
              <span className="admin-topbar__eyebrow">SmartDine · {restaurant?.name || "Restaurant"}</span>
              <strong>{TITLES[location.pathname] || "Workspace"}</strong>
            </div>
          </div>
          <div className="admin-topbar__right">
            <span className="admin-topbar__status">
              <span className="live-dot" /> Service live
            </span>
            <span className="admin-topbar__date">
              {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </span>
            <span className="admin-topbar__avatar">{initials(user?.name)}</span>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
