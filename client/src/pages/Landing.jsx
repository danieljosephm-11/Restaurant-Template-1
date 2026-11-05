import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  CreditCard,
  LayoutDashboard,
  MapPin,
  MonitorSmartphone,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Utensils,
  WalletCards,
} from "lucide-react";
import { Logo } from "../components/Logo.jsx";
import { useApiQuery, useDocumentTitle } from "../hooks/useApiQuery.js";
import { Button } from "../components/ui.jsx";

const PREVIEW_DISHES = [
  { image: "/foods/chicken-biryani.jpg", name: "Dum Chicken Biryani", price: "₹340", note: "Saffron · raita" },
  { image: "/foods/paneer-tikka.jpg", name: "Charred Paneer Tikka", price: "₹280", note: "Mint chutney" },
  { image: "/foods/gulab-jamun.jpg", name: "Gulab Jamun", price: "₹120", note: "Saffron syrup" },
];

export default function Landing() {
  useDocumentTitle("Double QR ordering & payments");
  const { data } = useApiQuery("/public/demo");
  const tableToken = data?.table?.token;
  const menuPath = tableToken ? `/t/${tableToken}` : "/admin/login";
  const payPath = tableToken ? `/pay/${tableToken}` : "/admin/login";
  const restaurant = data?.restaurant;

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav__inner">
          <Logo withWordmark size={38} />
          <nav className="landing-nav__links" aria-label="Main navigation">
            <a href="#experience">Experience</a>
            <a href="#double-qr">Double QR</a>
            <a href="#demo">Live demo</a>
          </nav>
          <div className="landing-nav__actions">
            <Link to="/kitchen" className="text-link landing-nav__kitchen">
              <ChefHat size={16} /> Kitchen display
            </Link>
            <Link to="/admin/login" className="button button--secondary button--sm">
              Sign in <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero__texture" aria-hidden="true" />
          <div className="hero__inner">
            <div className="hero__copy">
              <span className="eyebrow">
                <Sparkles size={14} /> Dynamic ordering, beautifully simple
              </span>
              <h1>
                Two QR codes.
                <br />
                <em>One seamless meal.</em>
              </h1>
              <p className="hero__lede">
                Guests scan to explore the menu, order in seconds and pay from their table. Your team sees every
                order, ticket and payment — live.
              </p>
              <div className="hero__actions">
                <Link to={menuPath} className="button button--primary button--lg">
                  Try the guest experience <ArrowRight size={18} />
                </Link>
                <Link to="/admin/login" className="button button--ghost-light button--lg">
                  <LayoutDashboard size={17} /> See the command centre
                </Link>
              </div>
              <ul className="hero__points">
                <li>
                  <Check size={14} /> No app to install
                </li>
                <li>
                  <Check size={14} /> Live kitchen updates
                </li>
                <li>
                  <Check size={14} /> Order-linked payments
                </li>
              </ul>
            </div>

            <div className="hero__visual">
              <div className="hero-photo hero-photo--main">
                <img src="/foods/butter-chicken.jpg" alt="Butter chicken served at Spice Route" />
                <span className="hero-photo__label">Chef's signature</span>
              </div>
              <div className="hero-photo hero-photo--small">
                <img src="/foods/mango-lassi.jpg" alt="Mango lassi" />
              </div>
              <div className="floating-card floating-card--order">
                <span className="floating-card__icon">
                  <Utensils size={17} />
                </span>
                <div>
                  <small>Table 03 · new order</small>
                  <strong>2× Chicken Biryani</strong>
                </div>
                <span className="live-dot" />
              </div>
              <div className="floating-card floating-card--secure">
                <ShieldCheck size={19} />
                <div>
                  <strong>Paid securely</strong>
                  <small>Linked to order #1148</small>
                </div>
              </div>
              <div className="hero__seal">
                <span>Freshly</span>
                <strong>plated</strong>
                <span>daily</span>
              </div>
            </div>
          </div>
          <div className="hero__marquee" aria-hidden="true">
            <span>Scan</span>
            <span className="marquee-dot">✦</span>
            <span>Order</span>
            <span className="marquee-dot">✦</span>
            <span>Cook</span>
            <span className="marquee-dot">✦</span>
            <span>Pay</span>
            <span className="marquee-dot">✦</span>
            <span>Enjoy</span>
          </div>
        </section>

        <section className="section section--experience" id="experience">
          <div className="section__inner">
            <div className="section-heading">
              <span className="eyebrow eyebrow--plain">A better table experience</span>
              <h2>
                From first glance to final bite,
                <br />
                everything happens <em>at the table.</em>
              </h2>
              <p>
                No waiting for menus, no chasing a bill. SmartDine gives guests control and gives your team a calmer,
                faster service.
              </p>
            </div>
            <div className="experience-grid">
              <article className="experience-card experience-card--menu">
                <div className="experience-card__top">
                  <span className="experience-card__number">01</span>
                  <span className="experience-card__icon">
                    <ScanLine size={21} />
                  </span>
                </div>
                <h3>Scan the menu QR</h3>
                <p>A beautiful, always-current digital menu with vivid dish photography, prices and sold-out status.</p>
                <div className="experience-card__mock experience-card__mock--menu">
                  <div className="mini-dish">
                    <img src="/foods/tandoori-chicken.jpg" alt="" />
                    <div>
                      <strong>Tandoori Chicken</strong>
                      <small>₹380</small>
                    </div>
                    <span>+</span>
                  </div>
                  <div className="mini-dish">
                    <img src="/foods/dal-makhani.jpg" alt="" />
                    <div>
                      <strong>Dal Makhani</strong>
                      <small>₹260</small>
                    </div>
                    <span>+</span>
                  </div>
                </div>
              </article>

              <article className="experience-card experience-card--kitchen">
                <div className="experience-card__top">
                  <span className="experience-card__number">02</span>
                  <span className="experience-card__icon">
                    <MonitorSmartphone size={21} />
                  </span>
                </div>
                <h3>Send it to the kitchen</h3>
                <p>Orders land on a live kitchen display instantly, with table, notes and prep times clearly visible.</p>
                <div className="experience-card__mock experience-card__mock--ticket">
                  <div className="mini-ticket__head">
                    <strong>Table 03</strong>
                    <span className="badge badge--amber badge--xs">New</span>
                  </div>
                  <p>2× Chicken Biryani</p>
                  <p>1× Paneer Tikka</p>
                  <small>One biryani mild, please.</small>
                  <div className="mini-ticket__foot">
                    <span>Just now</span>
                    <span className="mini-ticket__button">Start cooking →</span>
                  </div>
                </div>
              </article>

              <article className="experience-card experience-card--pay">
                <div className="experience-card__top">
                  <span className="experience-card__number">03</span>
                  <span className="experience-card__icon">
                    <WalletCards size={21} />
                  </span>
                </div>
                <h3>Pay with the second QR</h3>
                <p>A fresh, order-linked payment QR is generated on demand. The amount is always exact, never static.</p>
                <div className="experience-card__mock experience-card__mock--paid">
                  <span className="paid-check">
                    <Check size={24} />
                  </span>
                  <div>
                    <small>Payment received</small>
                    <strong>₹1,148.00</strong>
                    <span>Order #1148 · UPI</span>
                  </div>
                  <ShieldCheck size={18} className="paid-shield" />
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--double" id="double-qr">
          <div className="section__inner double-grid">
            <div className="double-copy">
              <span className="eyebrow eyebrow--plain">The double QR difference</span>
              <h2>
                One code to <em>order.</em>
                <br />
                One code to <em>settle up.</em>
              </h2>
              <p>
                Most QR menus stop at a PDF. SmartDine connects both sides of the meal to your live system — without a
                single static payment code.
              </p>
              <div className="double-feature">
                <span className="double-feature__icon">
                  <QrCode size={20} />
                </span>
                <div>
                  <h3>Menu QR · stuck to the table</h3>
                  <p>Opens the live menu, cart and order tracking for that exact table.</p>
                </div>
              </div>
              <div className="double-feature">
                <span className="double-feature__icon double-feature__icon--terracotta">
                  <CreditCard size={20} />
                </span>
                <div>
                  <h3>Payment QR · generated per order</h3>
                  <p>
                    Amount, order number and table are tied into a short-lived session — then verified server-side
                    before the order is marked paid.
                  </p>
                </div>
              </div>
              <div className="double-feature">
                <span className="double-feature__icon double-feature__icon--sage">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <h3>No double-charging</h3>
                  <p>Duplicate attempts are rejected, signatures verified and every payment is auditable.</p>
                </div>
              </div>
            </div>

            <div className="qr-stage">
              <div className="qr-stage__glow" aria-hidden="true" />
              <div className="qr-card qr-card--menu">
                <div className="qr-card__top">
                  <div>
                    <span className="qr-card__eyebrow">QR 01 · Table 01</span>
                    <h3>Browse & order</h3>
                  </div>
                  <QrCode size={20} />
                </div>
                {tableToken ? (
                  <img src={`/api/public/qr/${tableToken}/menu.png`} alt="Demo menu QR code" />
                ) : (
                  <div className="qr-card__placeholder">SD</div>
                )}
                <span className="qr-card__url">smartdine · menu</span>
              </div>
              <div className="qr-card qr-card--pay">
                <div className="qr-card__top">
                  <div>
                    <span className="qr-card__eyebrow">QR 02 · Order #1148</span>
                    <h3>Pay this order</h3>
                  </div>
                  <CreditCard size={20} />
                </div>
                {tableToken ? (
                  <img src={`/api/public/qr/${tableToken}/payment.png`} alt="Demo payment QR code" />
                ) : (
                  <div className="qr-card__placeholder">₹</div>
                )}
                <span className="qr-card__url">smartdine · pay at table</span>
              </div>
              <div className="qr-stage__badge">
                <Clock3 size={14} /> Payment links expire in 15 minutes
              </div>
            </div>
          </div>
        </section>

        <section className="section section--menu-preview">
          <div className="section__inner">
            <div className="menu-preview-head">
              <div>
                <span className="eyebrow eyebrow--plain">Made for appetites</span>
                <h2>Menus that make people <em>hungry.</em></h2>
              </div>
              <p>
                Full-bleed food photography, dietary markers and a quick add-to-cart flow. Every dish is managed from
                one dashboard.
              </p>
            </div>
            <div className="dish-preview-grid">
              {PREVIEW_DISHES.map((dish, index) => (
                <div className="dish-preview" key={dish.name}>
                  <div className="dish-preview__image">
                    <img src={dish.image} alt={dish.name} />
                    <span className="dish-preview__tag">0{index + 1}</span>
                  </div>
                  <div className="dish-preview__meta">
                    <div>
                      <h3>{dish.name}</h3>
                      <span>{dish.note}</span>
                    </div>
                    <strong>{dish.price}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section section--demo" id="demo">
          <div className="section__inner">
            <div className="demo-shell">
              <div className="demo-shell__intro">
                <span className="eyebrow">Live demo</span>
                <h2>Take it for a spin.</h2>
                <p>
                  {restaurant
                    ? `${restaurant.name} is seeded with a full menu, eight tables and two weeks of trading data.`
                    : "The demo restaurant is seeded with a full menu, eight tables and real trading history."}{" "}
                  Explore any side of the system.
                </p>
                {data?.paymentMode === "demo" ? (
                  <div className="demo-notice">
                    <ShieldCheck size={15} />
                    Demo payments are simulated. No real money moves.
                  </div>
                ) : null}
              </div>
              <div className="demo-paths">
                <Link to={menuPath} className="demo-path">
                  <span className="demo-path__icon">
                    <Utensils size={19} />
                  </span>
                  <div>
                    <strong>Guest menu</strong>
                    <span>Browse, order and track</span>
                  </div>
                  <ArrowRight size={18} />
                </Link>
                <Link to={payPath} className="demo-path">
                  <span className="demo-path__icon demo-path__icon--terracotta">
                    <CreditCard size={19} />
                  </span>
                  <div>
                    <strong>Table payment</strong>
                    <span>Open the table's bill</span>
                  </div>
                  <ArrowRight size={18} />
                </Link>
                <Link to="/admin/login" className="demo-path">
                  <span className="demo-path__icon demo-path__icon--sage">
                    <LayoutDashboard size={19} />
                  </span>
                  <div>
                    <strong>Admin dashboard</strong>
                    <span>admin@smartdine.app · Admin@123</span>
                  </div>
                  <ArrowRight size={18} />
                </Link>
                <Link to="/kitchen" className="demo-path">
                  <span className="demo-path__icon demo-path__icon--dark">
                    <ChefHat size={19} />
                  </span>
                  <div>
                    <strong>Kitchen display</strong>
                    <span>kitchen@smartdine.app · Kitchen@123</span>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="closing__inner">
            <span className="closing__mark">
              <Logo size={46} />
            </span>
            <blockquote>
              “The best technology at the table is the kind you <em>don't notice.</em>”
            </blockquote>
            <p>SmartDine keeps the hospitality human and the operations invisible.</p>
            <Link to={menuPath} className="button button--light button--lg">
              Start the demo <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <Logo withWordmark size={34} />
            <p>Dynamic QR ordering & payment for modern restaurants.</p>
          </div>
          <div className="landing-footer__col">
            <strong>Explore</strong>
            <Link to={menuPath}>Guest menu</Link>
            <Link to={payPath}>Table payment</Link>
            <Link to="/admin/login">Admin</Link>
            <Link to="/kitchen">Kitchen</Link>
          </div>
          <div className="landing-footer__col">
            <strong>Demo restaurant</strong>
            <span>
              <MapPin size={13} /> {restaurant?.address || "Indiranagar, Bengaluru"}
            </span>
            <span>{restaurant?.phone || "+91 80 4123 8890"}</span>
          </div>
          <div className="landing-footer__col">
            <strong>Built with care</strong>
            <span>React · Express · Socket.IO</span>
            <span>SQLite · Local-first demo</span>
          </div>
        </div>
        <div className="landing-footer__bottom">
          <span>© {new Date().getFullYear()} SmartDine. Demo experience.</span>
          <span>Double QR, zero friction.</span>
        </div>
      </footer>
    </div>
  );
}
