import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDocumentTitle } from "../hooks/useApiQuery.js";
import { Logo } from "../components/Logo.jsx";
import { Button, FormField } from "../components/ui.jsx";

const ACCOUNTS = [
  {
    role: "Admin",
    email: "admin@smartdine.app",
    password: "Admin@123",
    icon: LayoutDashboard,
    description: "Full dashboard access",
  },
  {
    role: "Kitchen",
    email: "kitchen@smartdine.app",
    password: "Kitchen@123",
    icon: ChefHat,
    description: "Kitchen display only",
  },
];

export default function LoginPage() {
  useDocumentTitle("Sign in");
  const { login, user, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("Admin");

  const next = searchParams.get("next");

  useEffect(() => {
    if (!authLoading && user) {
      const destination = next || (user.role === "kitchen" ? "/kitchen" : "/admin");
      navigate(destination, { replace: true });
    }
  }, [authLoading, user, next, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedIn = await login(email.trim(), password);
      toast.success(`Welcome back, ${loggedIn.name.split(" ")[0]}.`);
      const destination = next || (loggedIn.role === "kitchen" ? "/kitchen" : "/admin");
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function useDemo(account) {
    setEmail(account.email);
    setPassword(account.password);
    setSelectedRole(account.role);
    setError("");
  }

  return (
    <div className="login-page">
      <aside className="login-visual">
        <div className="login-visual__photo">
          <img src="/foods/tandoori-chicken.jpg" alt="" />
        </div>
        <div className="login-visual__overlay" />
        <div className="login-visual__content">
          <Link to="/" className="login-visual__brand">
            <Logo size={38} withWordmark />
          </Link>
          <div className="login-visual__quote">
            <span className="eyebrow">
              <Sparkles size={14} /> The command centre
            </span>
            <blockquote>
              “Every table, every ticket, every payment — <em>in one calm view.</em>”
            </blockquote>
            <p>Run service with fewer surprises and more time for hospitality.</p>
          </div>
          <div className="login-visual__stats">
            <div>
              <strong>8</strong>
              <span>Tables</span>
            </div>
            <div>
              <strong>19</strong>
              <span>Dishes</span>
            </div>
            <div>
              <strong>2</strong>
              <span>QR touchpoints</span>
            </div>
          </div>
          <div className="login-visual__live">
            <span className="live-dot" />
            <span>Demo restaurant is live</span>
            <span className="login-visual__live-divider" />
            <UtensilsCrossed size={14} />
            <span>Spice Route</span>
          </div>
        </div>
      </aside>

      <main className="login-panel">
        <div className="login-panel__inner">
          <Link to="/" className="login-panel__back">
            <ArrowLeft size={15} /> Back to SmartDine
          </Link>

          <div className="login-panel__head">
            <span className="login-panel__icon">
              <LockKeyhole size={21} />
            </span>
            <h1>Welcome back.</h1>
            <p>Sign in to the {selectedRole.toLowerCase()} workspace for Spice Route.</p>
          </div>

          <div className="login-role-tabs" role="tablist" aria-label="Demo account">
            {ACCOUNTS.map((account) => {
              const Icon = account.icon;
              return (
                <button
                  type="button"
                  key={account.role}
                  role="tab"
                  aria-selected={selectedRole === account.role}
                  className={`login-role-tab ${selectedRole === account.role ? "is-active" : ""}`}
                  onClick={() => useDemo(account)}
                >
                  <Icon size={17} />
                  <span>
                    <strong>{account.role}</strong>
                    <small>{account.description}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <FormField label="Email address" htmlFor="login-email">
              <span className="input-with-icon">
                <Mail size={17} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@restaurant.com"
                  required
                />
              </span>
            </FormField>
            <FormField label="Password" htmlFor="login-password">
              <span className="input-with-icon">
                <KeyRound size={17} />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="input-with-icon__action"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </FormField>

            {error ? <div className="login-error">{error}</div> : null}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Sign in to workspace <ArrowRight size={17} />
            </Button>
          </form>

          <div className="login-demo-note">
            <ShieldCheck size={15} />
            <p>
              These are seeded demo accounts. Choose a role above to fill the credentials, or enter them manually.
            </p>
          </div>

          <div className="login-credentials">
            <span>Demo credentials</span>
            <div>
              <code>admin@smartdine.app</code>
              <code>Admin@123</code>
            </div>
            <div>
              <code>kitchen@smartdine.app</code>
              <code>Kitchen@123</code>
            </div>
          </div>

          <footer className="login-panel__footer">
            <span>© {new Date().getFullYear()} SmartDine</span>
            <span>Demo environment · No real payments</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
