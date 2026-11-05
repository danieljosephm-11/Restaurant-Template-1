import { useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  BookOpen,
  Check,
  ChefHat,
  CircleOff,
  ImagePlus,
  Layers3,
  Leaf,
  Pencil,
  Plus,
  Search,
  Sprout,
  Trash2,
  UploadCloud,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useApiQuery, useDocumentTitle } from "../../hooks/useApiQuery.js";
import { api } from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";
import { classNames, money } from "../../lib/format.js";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Modal,
  Select,
  Skeleton,
  Toggle,
  VegMark,
} from "../../components/ui.jsx";

const EMPTY_ITEM = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  image: "",
  isVeg: true,
  available: true,
  sortOrder: 0,
};

const EMPTY_CATEGORY = { name: "", sortOrder: 0, active: true };

export default function AdminMenuPage() {
  useDocumentTitle("Menu manager");
  const toast = useToast();
  const { data, setData, loading, error, refetch, refreshing } = useApiQuery("/admin/menu");
  const [tab, setTab] = useState("dishes");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [itemModal, setItemModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef(null);

  const categories = data?.categories || [];
  const items = data?.items || [];

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase().trim();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query) || (item.categoryName || "").toLowerCase().includes(query);
    });
  }, [items, search, categoryFilter]);

  const stats = useMemo(
    () => ({
      total: items.length,
      available: items.filter((item) => item.available).length,
      soldOut: items.filter((item) => !item.available).length,
      veg: items.filter((item) => item.isVeg).length,
    }),
    [items]
  );

  function openNewItem() {
    setItemModal({
      mode: "create",
      values: { ...EMPTY_ITEM, categoryId: categories[0]?.id || "" },
    });
  }

  function openEditItem(item) {
    setItemModal({
      mode: "edit",
      id: item.id,
      values: {
        categoryId: item.categoryId,
        name: item.name,
        description: item.description || "",
        price: String(item.price),
        image: item.image || "",
        isVeg: item.isVeg,
        available: item.available,
        sortOrder: item.sortOrder ?? 0,
      },
    });
  }

  function updateItemField(field, value) {
    setItemModal((current) => ({ ...current, values: { ...current.values, [field]: value } }));
  }

  async function handleImageFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Images must be smaller than 3 MB.");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read that file."));
        reader.readAsDataURL(file);
      });
      const result = await api("/admin/uploads", { method: "POST", body: { dataUrl } });
      updateItemField("image", result.url);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveItem(event) {
    event.preventDefault();
    if (!itemModal) return;
    const values = itemModal.values;
    if (!values.name.trim()) return toast.error("Dish name is required.");
    if (!values.categoryId) return toast.error("Choose a category.");
    if (!values.price || Number(values.price) <= 0) return toast.error("Enter a valid price.");
    setSaving(true);
    try {
      const payload = {
        categoryId: values.categoryId,
        name: values.name.trim(),
        description: values.description.trim() || null,
        price: Number(values.price),
        image: values.image || null,
        isVeg: values.isVeg,
        available: values.available,
        sortOrder: Number(values.sortOrder) || 0,
      };
      if (itemModal.mode === "create") {
        await api("/admin/menu/items", { method: "POST", body: payload });
        toast.success("Dish added to the menu.");
      } else {
        await api(`/admin/menu/items/${itemModal.id}`, { method: "PATCH", body: payload });
        toast.success("Dish updated.");
      }
      setItemModal(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(item) {
    setData((current) => ({
      ...current,
      items: current.items.map((row) => (row.id === item.id ? { ...row, available: !row.available } : row)),
    }));
    try {
      await api(`/admin/menu/items/${item.id}`, { method: "PATCH", body: { available: !item.available } });
      toast.success(`${item.name} is now ${item.available ? "sold out" : "available"}.`);
    } catch (err) {
      toast.error(err.message);
      refetch({ silent: true });
    }
  }

  function openNewCategory() {
    setCategoryModal({ mode: "create", values: { ...EMPTY_CATEGORY, sortOrder: categories.length + 1 } });
  }

  function openEditCategory(category) {
    setCategoryModal({
      mode: "edit",
      id: category.id,
      values: { name: category.name, sortOrder: category.sortOrder, active: category.active },
    });
  }

  function updateCategoryField(field, value) {
    setCategoryModal((current) => ({ ...current, values: { ...current.values, [field]: value } }));
  }

  async function saveCategory(event) {
    event.preventDefault();
    if (!categoryModal) return;
    if (!categoryModal.values.name.trim()) return toast.error("Category name is required.");
    setSaving(true);
    try {
      const payload = {
        name: categoryModal.values.name.trim(),
        sortOrder: Number(categoryModal.values.sortOrder) || 0,
        active: categoryModal.values.active,
      };
      if (categoryModal.mode === "create") {
        await api("/admin/menu/categories", { method: "POST", body: payload });
        toast.success("Category created.");
      } else {
        await api(`/admin/menu/categories/${categoryModal.id}`, { method: "PATCH", body: payload });
        toast.success("Category updated.");
      }
      setCategoryModal(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "item") {
        await api(`/admin/menu/items/${deleteTarget.id}`, { method: "DELETE" });
        toast.success("Dish removed.");
      } else {
        await api(`/admin/menu/categories/${deleteTarget.id}`, { method: "DELETE" });
        toast.success("Category deleted.");
      }
      setDeleteTarget(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__head"><Skeleton width={250} height={40} /></div>
        <div className="menu-stats">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={94} radius={14} />)}</div>
        <Skeleton height={480} radius={18} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <ErrorState message={error.message} onRetry={refetch} title="Couldn't load the menu" />
      </div>
    );
  }

  return (
    <div className="admin-page admin-menu-page">
      <header className="admin-page__head">
        <div>
          <span className="admin-page__eyebrow"><BookOpen size={13} /> Menu management</span>
          <h1>Menu, mastered.</h1>
          <p>Update dishes, prices and availability. Changes appear on guest menus instantly.</p>
        </div>
        <div className="admin-page__actions">
          <Button variant="secondary" size="sm" icon={Plus} onClick={openNewCategory}>
            New category
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={openNewItem}>
            Add dish
          </Button>
        </div>
      </header>

      <div className="menu-stats">
        <div className="menu-stat"><span><UtensilsCrossed size={17} /></span><div><strong>{stats.total}</strong><small>Total dishes</small></div></div>
        <div className="menu-stat"><span className="is-green"><Check size={17} /></span><div><strong>{stats.available}</strong><small>Available now</small></div></div>
        <div className="menu-stat"><span className="is-red"><CircleOff size={17} /></span><div><strong>{stats.soldOut}</strong><small>Sold out</small></div></div>
        <div className="menu-stat"><span className="is-sage"><Leaf size={17} /></span><div><strong>{stats.veg}</strong><small>Vegetarian</small></div></div>
      </div>

      <div className="admin-tabs">
        <button type="button" className={tab === "dishes" ? "is-active" : ""} onClick={() => setTab("dishes")}>
          <UtensilsCrossed size={16} /> Dishes <span>{items.length}</span>
        </button>
        <button type="button" className={tab === "categories" ? "is-active" : ""} onClick={() => setTab("categories")}>
          <Layers3 size={16} /> Categories <span>{categories.length}</span>
        </button>
      </div>

      {tab === "dishes" ? (
        <section className="admin-panel menu-list-panel">
          <div className="admin-toolbar">
            <label className="search-box">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search dishes…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search ? <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button> : null}
            </label>
            <div className="admin-toolbar__right">
              <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category">
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </Select>
              <span className="admin-toolbar__count">{filteredItems.length} dishes</span>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No dishes match"
              description="Try another search or category."
              action={<Button variant="secondary" onClick={() => { setSearch(""); setCategoryFilter("all"); }}>Clear filters</Button>}
            />
          ) : (
            <div className="dish-table">
              <div className="dish-table__head">
                <span>Dish</span>
                <span>Category</span>
                <span>Price</span>
                <span>Diet</span>
                <span>Availability</span>
                <span />
              </div>
              {filteredItems.map((item) => (
                <div className="dish-row" key={item.id}>
                  <div className="dish-row__dish">
                    <div className="dish-row__image">
                      {item.image ? <img src={item.image} alt="" loading="lazy" /> : <UtensilsCrossed size={17} />}
                    </div>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.description || "No description"}</span>
                    </div>
                  </div>
                  <span className="dish-row__category">{item.categoryName}</span>
                  <strong className="dish-row__price">{money(item.price)}</strong>
                  <span><VegMark isVeg={item.isVeg} /></span>
                  <div className="dish-row__availability">
                    <Toggle checked={item.available} onChange={() => toggleAvailability(item)} />
                    <span className={item.available ? "text-green" : "text-muted"}>{item.available ? "Available" : "Sold out"}</span>
                  </div>
                  <div className="dish-row__actions">
                    <IconButton label={`Edit ${item.name}`} onClick={() => openEditItem(item)}><Pencil size={15} /></IconButton>
                    <IconButton label={`Delete ${item.name}`} variant="danger-ghost" onClick={() => setDeleteTarget({ type: "item", id: item.id, name: item.name })}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="category-manager">
          <div className="category-manager__head">
            <div>
              <h2>Menu sections</h2>
              <p>Drag-free ordering: set a sort order to control how sections appear on the guest menu.</p>
            </div>
            <Button variant="secondary" size="sm" icon={Plus} onClick={openNewCategory}>Add category</Button>
          </div>
          <div className="category-cards">
            {categories.map((category, index) => (
              <article className={`category-card ${!category.active ? "is-inactive" : ""}`} key={category.id}>
                <div className="category-card__top">
                  <span className="category-card__index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="category-card__actions">
                    <IconButton label={`Edit ${category.name}`} onClick={() => openEditCategory(category)}><Pencil size={14} /></IconButton>
                    <IconButton
                      label={`Delete ${category.name}`}
                      variant="danger-ghost"
                      onClick={() => setDeleteTarget({ type: "category", id: category.id, name: category.name })}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
                <h3>{category.name}</h3>
                <p>{category.itemCount} {category.itemCount === 1 ? "dish" : "dishes"} · order #{category.sortOrder}</p>
                <div className="category-card__bottom">
                  <span className={`status-pill ${category.active ? "is-active" : "is-off"}`}>
                    <span /> {category.active ? "Visible" : "Hidden"}
                  </span>
                  <button type="button" className="text-button" onClick={() => openEditCategory(category)}>Manage</button>
                </div>
              </article>
            ))}
            <button type="button" className="category-card category-card--add" onClick={openNewCategory}>
              <span><Plus size={20} /></span>
              <strong>Add a section</strong>
              <small>Starters, mains, desserts…</small>
            </button>
          </div>
        </div>
      )}

      <Modal
        open={!!itemModal}
        onClose={() => !saving && setItemModal(null)}
        title={itemModal?.mode === "create" ? "Add a new dish" : "Edit dish"}
        description="Changes go live on the guest menu as soon as you save."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setItemModal(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={saveItem} loading={saving}>
              {itemModal?.mode === "create" ? "Add dish" : "Save changes"}
            </Button>
          </>
        }
      >
        {itemModal ? (
          <form className="menu-form" onSubmit={saveItem}>
            <div className="menu-form__image-col">
              <div className="menu-image-upload">
                {itemModal.values.image ? (
                  <>
                    <img src={itemModal.values.image} alt="Dish preview" />
                    <button type="button" onClick={() => updateItemField("image", "")} className="menu-image-upload__remove" aria-label="Remove image">
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <div className="menu-image-upload__empty">
                    <ImagePlus size={24} />
                    <span>Dish photo</span>
                  </div>
                )}
                <button
                  type="button"
                  className="menu-image-upload__button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Uploading…" : itemModal.values.image ? "Replace image" : "Upload image"}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImageFile} />
                <small>JPG, PNG or WebP · max 3 MB</small>
              </div>
              <VegMark isVeg={itemModal.values.isVeg} />
              <span className="menu-image-upload__hint">Preview</span>
            </div>
            <div className="menu-form__fields">
              <FormField label="Dish name" htmlFor="dish-name">
                <input
                  id="dish-name"
                  className="input"
                  value={itemModal.values.name}
                  onChange={(event) => updateItemField("name", event.target.value)}
                  placeholder="e.g. Butter Chicken"
                  required
                />
              </FormField>
              <div className="form-row">
                <FormField label="Category" htmlFor="dish-category">
                  <Select id="dish-category" value={itemModal.values.categoryId} onChange={(event) => updateItemField("categoryId", event.target.value)}>
                    <option value="">Choose a category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="Price" htmlFor="dish-price">
                  <span className="input-prefix"><span>₹</span><input id="dish-price" type="number" min="1" step="1" className="input" value={itemModal.values.price} onChange={(event) => updateItemField("price", event.target.value)} placeholder="280" required /></span>
                </FormField>
              </div>
              <FormField label="Description" htmlFor="dish-description" optional>
                <textarea
                  id="dish-description"
                  className="input textarea"
                  rows={3}
                  maxLength={300}
                  value={itemModal.values.description}
                  onChange={(event) => updateItemField("description", event.target.value)}
                  placeholder="A short, delicious description…"
                />
              </FormField>
              <div className="form-row">
                <FormField label="Sort order" htmlFor="dish-sort" hint="Lower numbers appear first in the section.">
                  <input id="dish-sort" type="number" min="0" max="999" className="input" value={itemModal.values.sortOrder} onChange={(event) => updateItemField("sortOrder", event.target.value)} />
                </FormField>
                <div className="form-toggles">
                  <FormField label="Dietary">
                    <div className="segmented">
                      <button type="button" className={itemModal.values.isVeg ? "is-active" : ""} onClick={() => updateItemField("isVeg", true)}>
                        <Sprout size={14} /> Veg
                      </button>
                      <button type="button" className={!itemModal.values.isVeg ? "is-active" : ""} onClick={() => updateItemField("isVeg", false)}>
                        <ChefHat size={14} /> Non-veg
                      </button>
                    </div>
                  </FormField>
                  <FormField label="Availability">
                    <Toggle checked={itemModal.values.available} onChange={(value) => updateItemField("available", value)} label={itemModal.values.available ? "Available" : "Sold out"} />
                  </FormField>
                </div>
              </div>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={!!categoryModal}
        onClose={() => !saving && setCategoryModal(null)}
        title={categoryModal?.mode === "create" ? "New menu category" : "Edit category"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCategoryModal(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={saveCategory} loading={saving}>Save category</Button>
          </>
        }
      >
        {categoryModal ? (
          <form onSubmit={saveCategory} className="category-form">
            <FormField label="Category name" htmlFor="category-name">
              <input id="category-name" className="input" value={categoryModal.values.name} onChange={(event) => updateCategoryField("name", event.target.value)} placeholder="e.g. Starters" required autoFocus />
            </FormField>
            <FormField label="Sort order" htmlFor="category-sort" hint="Sections are shown from lowest to highest.">
              <input id="category-sort" type="number" min="0" max="999" className="input" value={categoryModal.values.sortOrder} onChange={(event) => updateCategoryField("sortOrder", event.target.value)} />
            </FormField>
            <Toggle checked={categoryModal.values.active} onChange={(value) => updateCategoryField("active", value)} label="Visible on guest menu" />
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title={deleteTarget?.type === "category" ? `Delete “${deleteTarget?.name}”?` : `Delete “${deleteTarget?.name}”?`}
        description={
          deleteTarget?.type === "category"
            ? "This category can only be deleted when it has no dishes. This cannot be undone."
            : "This dish will be removed from the menu and cannot be recovered."
        }
        confirmLabel={deleteTarget?.type === "category" ? "Delete category" : "Delete dish"}
      />
    </div>
  );
}
