import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ChevronLeft,
  Clock3,
  Leaf,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useApiQuery, useDocumentTitle } from "../hooks/useApiQuery.js";
import { money, greeting } from "../lib/format.js";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { Logo } from "../components/Logo.jsx";
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Skeleton,
  SkeletonCard,
  Spinner,
  Stepper,
  VegMark,
} from "../components/ui.jsx";
import { OrderStatusBadge } from "../components/StatusBadge.jsx";

function readCart(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function CartDrawer({ open, onClose, cartLines, restaurant, table, notes, setNotes, onPlace, placing, onChangeQty, onClear }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const subtotal = cartLines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  const taxPercent = restaurant?.taxPercent ?? 0;
  const servicePercent = restaurant?.serviceChargePercent ?? 0;
  const tax = (subtotal * taxPercent) / 100;
  const service = (subtotal * servicePercent) / 100;
  const total = subtotal + tax + service;
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  return createPortal(
    <div className="cart-layer">
      <button type="button" className="cart-backdrop" onClick={onClose} aria-label="Close cart" />
      <aside className="cart-drawer" aria-label="Your cart">
        <div className="cart-drawer__head">
          <div>
            <span className="eyebrow eyebrow--plain">Your table order</span>
            <h2>
              The bag <span>{itemCount > 0 ? `· ${itemCount}` : ""}</span>
            </h2>
          </div>
          <IconButton label="Close cart" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>

        <div className="cart-drawer__body">
          {cartLines.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your bag is empty"
              description="Add something from the menu and it will appear here."
            />
          ) : (
            <>
              <div className="cart-lines">
                {cartLines.map(({ item, quantity }) => (
                  <div className="cart-line" key={item.id}>
                    <div className="cart-line__image">
                      {item.image ? <img src={item.image} alt="" /> : <UtensilsCrossed size={18} />}
                    </div>
                    <div className="cart-line__info">
                      <div className="cart-line__title">
                        <VegMark isVeg={item.isVeg} size="sm" />
                        <strong>{item.name}</strong>
                      </div>
                      <span>{money(item.price)} each</span>
                      <div className="cart-line__bottom">
                        <Stepper
                          value={quantity}
                          min={1}
                          max={20}
                          size="sm"
                          onChange={(next) => onChangeQty(item.id, next)}
                          label={`Quantity of ${item.name}`}
                        />
                        <strong>{money(item.price * quantity)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="cart-clear" onClick={onClear}>
                Clear bag
              </button>

              <label className="cart-note">
                <span>Anything we should know?</span>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="Allergies, spice level, a birthday candle…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <small>{notes.length}/300</small>
              </label>
            </>
          )}
        </div>

        {cartLines.length > 0 ? (
          <div className="cart-drawer__foot">
            <div className="cart-totals">
              <div>
                <span>Subtotal</span>
                <span>{money(subtotal, restaurant?.currency)}</span>
              </div>
              {taxPercent > 0 ? (
                <div>
                  <span>GST ({taxPercent}%)</span>
                  <span>{money(tax, restaurant?.currency)}</span>
                </div>
              ) : null}
              {servicePercent > 0 ? (
                <div>
                  <span>Service charge ({servicePercent}%)</span>
                  <span>{money(service, restaurant?.currency)}</span>
                </div>
              ) : null}
              <div className="cart-totals__grand">
                <span>Total</span>
                <strong>{money(total, restaurant?.currency)}</strong>
              </div>
            </div>
            <Button variant="primary" size="lg" fullWidth onClick={onPlace} loading={placing}>
              {placing ? "Sending to kitchen…" : "Place order"} <ArrowRight size={18} />
            </Button>
            <p className="cart-drawer__fineprint">
              <Clock3 size={13} /> Your order goes straight to the kitchen at {table?.name || "your table"}.
            </p>
          </div>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}

export default function MenuPage() {
  const { tableToken } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, refetch } = useApiQuery(`/public/menu/${tableToken}`);
  const cartKey = `smartdine.cart.${tableToken}`;
  const [cart, setCart] = useState(() => readCart(cartKey));
  const [notes, setNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const categoryRefs = useRef({});
  const menuTopRef = useRef(null);

  useDocumentTitle(data?.restaurant?.name ? `${data.restaurant.name} menu` : "Table menu");

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart, cartKey]);

  useEffect(() => {
    if (!data) return;
    setCart((current) => {
      const validIds = new Set(data.categories.flatMap((category) => category.items.map((item) => item.id)));
      const next = {};
      for (const [id, quantity] of Object.entries(current)) {
        if (validIds.has(id) && Number(quantity) > 0) next[id] = Math.min(20, Number(quantity));
      }
      return next;
    });
    if (data.categories[0] && !activeCategory) setActiveCategory(data.categories[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const itemMap = useMemo(() => {
    const map = new Map();
    for (const category of data?.categories || []) {
      for (const item of category.items) map.set(item.id, item);
    }
    return map;
  }, [data]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => ({ item: itemMap.get(id), quantity: Number(quantity) }))
        .filter((line) => line.item && line.quantity > 0),
    [cart, itemMap]
  );

  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const restaurant = data?.restaurant;
  const table = data?.table;

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.categories || [])
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          if (vegOnly && !item.isVeg) return false;
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(query) ||
            (item.description || "").toLowerCase().includes(query) ||
            category.name.toLowerCase().includes(query)
          );
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [data, search, vegOnly]);

  const visibleCount = filteredCategories.reduce((sum, category) => sum + category.items.length, 0);

  function setQuantity(foodId, quantity) {
    setCart((current) => {
      if (quantity <= 0) {
        const next = { ...current };
        delete next[foodId];
        return next;
      }
      return { ...current, [foodId]: Math.min(20, quantity) };
    });
  }

  function addItem(item) {
    if (!item.available) return;
    setQuantity(item.id, (cart[item.id] || 0) + 1);
  }

  function scrollToCategory(id) {
    setActiveCategory(id);
    const node = categoryRefs.current[id];
    if (node) {
      const offset = 148;
      const top = node.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  async function placeOrder() {
    if (!cartLines.length) return;
    setPlacing(true);
    try {
      const payload = {
        tableToken,
        items: cartLines.map(({ item, quantity }) => ({ foodId: item.id, quantity })),
        notes: notes.trim() || undefined,
      };
      const result = await api("/public/orders", { method: "POST", body: payload });
      try {
        localStorage.removeItem(cartKey);
      } catch {
        /* ignore */
      }
      setCart({});
      setNotes("");
      setCartOpen(false);
      toast.success(`Order ${result.orderCode} is on its way to the kitchen.`);
      navigate(`/order/${result.publicToken}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <div className="customer-page">
        <div className="menu-skeleton-head">
          <Skeleton width={130} height={22} />
          <Skeleton width="52%" height={56} />
          <Skeleton width="34%" height={18} />
        </div>
        <div className="menu-skeleton-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-error-page">
        <Logo withWordmark size={40} />
        <ErrorState
          title="This table link isn't working"
          message={error.message}
          onRetry={refetch}
        />
        <Link to="/" className="text-link">
          <ChevronLeft size={15} /> Back to SmartDine
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const activeOrder = data.activeOrder;

  return (
    <div className="customer-page menu-page">
      <header className="customer-header customer-header--menu">
        <div className="customer-header__inner">
          <Link to="/" className="customer-header__brand" aria-label="SmartDine home">
            <Logo size={36} />
            <span>
              <strong>{restaurant.name}</strong>
              <small>{restaurant.tagline}</small>
            </span>
          </Link>
          <div className="customer-header__table">
            <span className="table-pill">
              <span className="table-pill__dot" />
              {table.name}
            </span>
            <button type="button" className="cart-button" onClick={() => setCartOpen(true)}>
              <ShoppingBag size={18} />
              <span>Bag</span>
              {cartCount > 0 ? <strong>{cartCount}</strong> : null}
            </button>
          </div>
        </div>
      </header>

      <main>
        {activeOrder ? (
          <div className="active-order-strip">
            <div className="active-order-strip__inner">
              <span className="active-order-strip__icon">
                <Sparkles size={15} />
              </span>
              <p>
                You have an order in progress · <strong>{activeOrder.orderCode}</strong>
              </p>
              <OrderStatusBadge status={activeOrder.status} />
              <Link to={`/order/${activeOrder.publicToken}`} className="active-order-strip__link">
                Track order <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : null}

        <section className="menu-hero" ref={menuTopRef}>
          <div className="menu-hero__inner">
            <div className="menu-hero__copy">
              <span className="eyebrow">
                <span className="eyebrow__spark">✦</span> {greeting()} — welcome to the table
              </span>
              <h1>
                A menu made for <em>lingering.</em>
              </h1>
              <p>
                Modern Indian plates, slow-cooked classics and something cold to drink. Order as you go — everything
                comes straight from the kitchen.
              </p>
              <div className="menu-hero__meta">
                <span>
                  <Leaf size={14} /> {data.categories.reduce((count, category) => count + category.items.filter((item) => item.isVeg).length, 0)} vegetarian dishes
                </span>
                <span className="menu-hero__meta-divider" />
                <span>GST {restaurant.taxPercent}% applied at checkout</span>
              </div>
            </div>
            <div className="menu-hero__art">
              <div className="menu-hero__image">
                <img src="/foods/tandoori-chicken.jpg" alt="Tandoori chicken at the table" />
              </div>
              <div className="menu-hero__stamp">
                <span>Spice</span>
                <strong>Route</strong>
                <span>Since '24</span>
              </div>
            </div>
          </div>
        </section>

        <div className="menu-toolbar">
          <div className="menu-toolbar__inner">
            <div className="category-tabs" role="tablist" aria-label="Menu categories">
              {data.categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={`category-tab ${activeCategory === category.id ? "is-active" : ""}`}
                  onClick={() => scrollToCategory(category.id)}
                  role="tab"
                  aria-selected={activeCategory === category.id}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <div className="menu-toolbar__controls">
              <label className="search-box search-box--small">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Find a dish…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search menu"
                />
                {search ? (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <X size={14} />
                  </button>
                ) : null}
              </label>
              <button
                type="button"
                className={`veg-filter ${vegOnly ? "is-active" : ""}`}
                onClick={() => setVegOnly((value) => !value)}
                aria-pressed={vegOnly}
              >
                <VegMark isVeg size="sm" /> Veg only
              </button>
            </div>
          </div>
        </div>

        <div className="menu-body">
          {visibleCount === 0 ? (
            <EmptyState
              icon={Search}
              title="No dishes found"
              description="Try a different search, or turn off the vegetarian filter."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setVegOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            filteredCategories.map((category) => (
              <section
                className="menu-category"
                key={category.id}
                ref={(node) => {
                  categoryRefs.current[category.id] = node;
                }}
              >
                <div className="menu-category__head">
                  <div>
                    <span className="menu-category__index">{String(data.categories.findIndex((c) => c.id === category.id) + 1).padStart(2, "0")}</span>
                    <h2>{category.name}</h2>
                  </div>
                  <span>{category.items.length} {category.items.length === 1 ? "dish" : "dishes"}</span>
                </div>
                <div className="dish-grid">
                  {category.items.map((item) => {
                    const quantity = cart[item.id] || 0;
                    return (
                      <article className={`dish-card ${!item.available ? "is-unavailable" : ""}`} key={item.id}>
                        <div className="dish-card__image">
                          {item.image ? (
                            <img src={item.image} alt={item.name} loading="lazy" />
                          ) : (
                            <span className="dish-card__image-fallback">
                              <UtensilsCrossed size={28} />
                            </span>
                          )}
                          <div className="dish-card__badges">
                            <VegMark isVeg={item.isVeg} />
                            {!item.available ? <span className="sold-out">Sold out</span> : null}
                          </div>
                          {item.available ? (
                            quantity > 0 ? (
                              <div className="dish-card__stepper">
                                <Stepper
                                  value={quantity}
                                  min={0}
                                  max={20}
                                  size="sm"
                                  onChange={(next) => setQuantity(item.id, next)}
                                  label={`Quantity of ${item.name}`}
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="dish-card__add"
                                onClick={() => addItem(item)}
                                aria-label={`Add ${item.name} to bag`}
                              >
                                <Plus size={19} />
                              </button>
                            )
                          ) : null}
                        </div>
                        <div className="dish-card__body">
                          <div className="dish-card__title">
                            <h3>{item.name}</h3>
                            <strong>{money(item.price, restaurant.currency)}</strong>
                          </div>
                          <p>{item.description}</p>
                          {quantity > 0 ? (
                            <span className="dish-card__inbag">
                              {quantity} in your bag · {money(item.price * quantity, restaurant.currency)}
                            </span>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          <div className="menu-footer-note">
            <Logo size={32} />
            <p>
              Prepared fresh in the {restaurant.name} kitchen. Please tell our team about any allergies.
            </p>
            <span>{restaurant.address}</span>
          </div>
        </div>
      </main>

      {cartCount > 0 && !cartOpen ? (
        <button type="button" className="mobile-cart-bar" onClick={() => setCartOpen(true)}>
          <span className="mobile-cart-bar__count">{cartCount}</span>
          <span>View your bag</span>
          <strong>
            {money(
              cartLines.reduce((sum, line) => sum + line.item.price * line.quantity, 0),
              restaurant.currency
            )}
          </strong>
          <ArrowRight size={18} />
        </button>
      ) : null}

      <button
        type="button"
        className={`floating-cart ${cartCount === 0 ? "is-empty" : ""}`}
        onClick={() => setCartOpen(true)}
        aria-label={cartCount ? `Open cart with ${cartCount} items` : "Open cart"}
      >
        {cartCount > 0 ? (
          <>
            <span className="floating-cart__count">{cartCount}</span>
            <span className="floating-cart__text">
              <small>Your order</small>
              <strong>{money(cartLines.reduce((sum, line) => sum + line.item.price * line.quantity, 0), restaurant.currency)}</strong>
            </span>
            <ArrowRight size={18} />
          </>
        ) : (
          <ShoppingBag size={20} />
        )}
      </button>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartLines={cartLines}
        restaurant={restaurant}
        table={table}
        notes={notes}
        setNotes={setNotes}
        onPlace={placeOrder}
        placing={placing}
        onChangeQty={setQuantity}
        onClear={() => setCart({})}
      />
    </div>
  );
}
