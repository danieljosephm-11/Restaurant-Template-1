import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Grid2X2,
  Link2,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Store,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useApiQuery, useDocumentTitle } from "../../hooks/useApiQuery.js";
import { api } from "../../lib/api.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { TABLE_STATUS, classNames } from "../../lib/format.js";
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
} from "../../components/ui.jsx";
import { TableStatusBadge } from "../../components/StatusBadge.jsx";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function printQrSheets(tables, restaurantName) {
  if (!tables.length) return false;
  const origin = window.location.origin;
  const win = window.open("", "_blank", "width=980,height=760");
  if (!win) return false;
  const cards = tables
    .map(
      (table) => `
      <article class="sheet">
        <div class="sheet-head">
          <div>
            <p class="eyebrow">${escapeHtml(restaurantName || "SmartDine")}</p>
            <h2>${escapeHtml(table.name)}</h2>
            <p class="hint">Scan one code to order · scan the other to pay</p>
          </div>
          <span class="table-no">${String(table.number).padStart(2, "0")}</span>
        </div>
        <div class="qr-row">
          <div class="qr-block">
            <span class="qr-tag">01 · Menu</span>
            <img src="${origin}${table.qr.menu}" alt="Menu QR for ${escapeHtml(table.name)}" />
            <strong>Browse & order</strong>
            <small>${escapeHtml(table.menuUrl)}</small>
          </div>
          <div class="qr-block qr-block--pay">
            <span class="qr-tag">02 · Payment</span>
            <img src="${origin}${table.qr.payment}" alt="Payment QR for ${escapeHtml(table.name)}" />
            <strong>View bill & pay</strong>
            <small>${escapeHtml(table.payUrl)}</small>
          </div>
        </div>
        <div class="sheet-foot">
          <span>No app needed</span>
          <span>Secure, order-linked payments</span>
          <span>SmartDine</span>
        </div>
      </article>`
    )
    .join("");

  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>QR table cards · ${escapeHtml(restaurantName || "SmartDine")}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; color: #1a251f; background: #fff; }
  .sheet { border: 1.5px solid #d8d0c2; border-radius: 18px; padding: 18px; margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; }
  .sheet-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px dashed #ddd5c8; padding-bottom: 12px; margin-bottom: 14px; }
  .eyebrow { margin: 0 0 4px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #b15c3b; font-weight: 700; }
  h2 { margin: 0; font-family: Georgia, serif; font-size: 22px; }
  .hint { margin: 4px 0 0; color: #6d756f; font-size: 10px; }
  .table-no { font-family: Georgia, serif; font-size: 30px; color: #173d2c; }
  .qr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .qr-block { display: flex; flex-direction: column; align-items: center; border: 1px solid #ece5da; border-radius: 14px; padding: 12px 10px 10px; text-align: center; }
  .qr-block--pay { background: #fbf6ee; }
  .qr-block img { width: 158px; height: 158px; object-fit: contain; }
  .qr-tag { align-self: flex-start; font-size: 8px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #b15c3b; }
  .qr-block strong { margin-top: 6px; font-size: 12px; }
  .qr-block small { margin-top: 3px; max-width: 210px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8a8f89; font-size: 7.5px; }
  .sheet-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #eee8de; color: #7c847d; font-size: 8px; text-transform: uppercase; letter-spacing: 1px; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>${cards}<script>window.onload = () => setTimeout(() => window.print(), 350);<\/script></body>
</html>`);
  win.document.close();
  return true;
}

const EMPTY_TABLE = { number: "", name: "", status: "available" };

export default function AdminTablesPage() {
  useDocumentTitle("Tables & QR codes");
  const { restaurant } = useAuth();
  const toast = useToast();
  const { data, loading, error, refetch, refreshing } = useApiQuery("/admin/tables");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tableModal, setTableModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const tables = data?.tables || [];
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return tables.filter((table) => {
      if (statusFilter !== "all" && table.status !== statusFilter) return false;
      if (!query) return true;
      return table.name.toLowerCase().includes(query) || String(table.number).includes(query);
    });
  }, [tables, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: tables.length,
      available: tables.filter((table) => table.status === "available" && table.activeOrders === 0).length,
      occupied: tables.filter((table) => table.activeOrders > 0 || table.status === "occupied").length,
      inactive: tables.filter((table) => table.status === "inactive").length,
    }),
    [tables]
  );

  function openNew() {
    const nextNumber = tables.reduce((max, table) => Math.max(max, table.number), 0) + 1;
    setTableModal({
      mode: "create",
      values: { ...EMPTY_TABLE, number: String(nextNumber), name: `Table ${String(nextNumber).padStart(2, "0")}` },
    });
  }

  function openEdit(table) {
    setTableModal({
      mode: "edit",
      id: table.id,
      values: { number: String(table.number), name: table.name, status: table.status },
    });
  }

  function updateField(field, value) {
    setTableModal((current) => ({ ...current, values: { ...current.values, [field]: value } }));
  }

  async function saveTable(event) {
    event?.preventDefault();
    if (!tableModal) return;
    if (!tableModal.values.number) return toast.error("Table number is required.");
    if (!tableModal.values.name.trim()) return toast.error("Table name is required.");
    setSaving(true);
    try {
      const payload = {
        number: Number(tableModal.values.number),
        name: tableModal.values.name.trim(),
        status: tableModal.values.status,
      };
      if (tableModal.mode === "create") {
        await api("/admin/tables", { method: "POST", body: payload });
        toast.success(`${payload.name} added with fresh QR codes.`);
      } else {
        await api(`/admin/tables/${tableModal.id}`, { method: "PATCH", body: payload });
        toast.success("Table updated.");
      }
      setTableModal(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      if (confirm.type === "regenerate") {
        const result = await api(`/admin/tables/${confirm.table.id}/regenerate`, { method: "POST", body: {} });
        toast.success("New QR codes generated. Reprint this table's cards.");
        if (result.warning) toast.info(result.warning, { duration: 6500 });
      } else if (confirm.type === "delete") {
        await api(`/admin/tables/${confirm.table.id}`, { method: "DELETE" });
        toast.success("Table deleted.");
      }
      setConfirm(null);
      refetch({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmLoading(false);
    }
  }

  function handlePrint(selected) {
    const ok = printQrSheets(selected, restaurant?.name);
    if (!ok) toast.error("Allow pop-ups to print QR cards.");
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast.info("Link copied.");
    } catch {
      toast.error("Could not copy that link.");
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__head"><Skeleton width={280} height={40} /></div>
        <div className="menu-stats">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={94} radius={14} />)}</div>
        <div className="qr-card-grid">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={380} radius={18} />)}</div>
      </div>
    );
  }

  if (error) {
    return <div className="admin-page"><ErrorState message={error.message} onRetry={refetch} title="Couldn't load tables" /></div>;
  }

  return (
    <div className="admin-page admin-tables-page">
      <header className="admin-page__head">
        <div>
          <span className="admin-page__eyebrow"><Grid2X2 size={13} /> Floor & QR management</span>
          <h1>Every table, ready to scan.</h1>
          <p>Print menu and payment QR cards, manage table status and regenerate links when needed.</p>
        </div>
        <div className="admin-page__actions">
          <Button variant="secondary" size="sm" icon={Printer} onClick={() => handlePrint(filtered)} disabled={!filtered.length}>
            Print all
          </Button>
          <Button variant="primary" size="sm" icon={Plus} onClick={openNew}>Add table</Button>
        </div>
      </header>

      <div className="menu-stats">
        <div className="menu-stat"><span><Store size={17} /></span><div><strong>{stats.total}</strong><small>Total tables</small></div></div>
        <div className="menu-stat"><span className="is-green"><Check size={17} /></span><div><strong>{stats.available}</strong><small>Available</small></div></div>
        <div className="menu-stat"><span className="is-amber"><Users size={17} /></span><div><strong>{stats.occupied}</strong><small>In service</small></div></div>
        <div className="menu-stat"><span className="is-red"><X size={17} /></span><div><strong>{stats.inactive}</strong><small>Out of service</small></div></div>
      </div>

      <div className="admin-toolbar tables-toolbar">
        <label className="search-box">
          <Search size={16} />
          <input type="search" placeholder="Find a table…" value={search} onChange={(event) => setSearch(event.target.value)} />
          {search ? <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button> : null}
        </label>
        <div className="admin-toolbar__right">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter tables by status">
            <option value="all">All statuses</option>
            {Object.entries(TABLE_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </Select>
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => refetch({ silent: true })} loading={refreshing}>Refresh</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="admin-panel">
          <EmptyState
            icon={QrCode}
            title={tables.length ? "No tables match" : "No tables yet"}
            description={tables.length ? "Try a different search or status." : "Add your first table to generate its double QR codes."}
            action={<Button variant="primary" onClick={openNew} icon={Plus}>Add a table</Button>}
          />
        </div>
      ) : (
        <div className="qr-card-grid">
          {filtered.map((table) => (
            <article className={classNames("table-card", `table-card--${table.status}`)} key={table.id}>
              <div className="table-card__head">
                <div className="table-card__title">
                  <span className="table-card__number">{String(table.number).padStart(2, "0")}</span>
                  <div>
                    <h2>{table.name}</h2>
                    <TableStatusBadge status={table.activeOrders > 0 && table.status !== "inactive" ? "occupied" : table.status} />
                  </div>
                </div>
                <div className="table-card__actions">
                  <IconButton label={`Edit ${table.name}`} onClick={() => openEdit(table)}><Pencil size={15} /></IconButton>
                  <IconButton label={`Print ${table.name} QR cards`} onClick={() => handlePrint([table])}><Printer size={15} /></IconButton>
                </div>
              </div>

              <div className="table-card__qrs">
                <div className="mini-qr">
                  <div className="mini-qr__image">
                    <img src={table.qr.menu} alt={`${table.name} menu QR`} loading="lazy" />
                  </div>
                  <div className="mini-qr__body">
                    <span>QR 01</span>
                    <strong>Menu & order</strong>
                    <button type="button" onClick={() => copyLink(table.menuUrl)} title="Copy menu URL"><Link2 size={12} /> Copy link</button>
                  </div>
                </div>
                <div className="mini-qr mini-qr--pay">
                  <div className="mini-qr__image">
                    <img src={table.qr.payment} alt={`${table.name} payment QR`} loading="lazy" />
                  </div>
                  <div className="mini-qr__body">
                    <span>QR 02</span>
                    <strong>Bill & payment</strong>
                    <button type="button" onClick={() => copyLink(table.payUrl)} title="Copy payment URL"><Link2 size={12} /> Copy link</button>
                  </div>
                </div>
              </div>

              <div className="table-card__meta">
                <span>
                  <QrCode size={13} /> Token <code>{table.token.slice(0, 8)}…</code>
                </span>
                <span>{table.activeOrders > 0 ? `${table.activeOrders} active order${table.activeOrders > 1 ? "s" : ""}` : "No active orders"}</span>
              </div>

              <div className="table-card__footer">
                <a href={table.menuUrl} target="_blank" rel="noreferrer" className="button button--ghost button--sm">
                  <ExternalLink size={14} /> Preview menu
                </a>
                <div>
                  <IconButton
                    label={`Regenerate QR for ${table.name}`}
                    onClick={() => setConfirm({ type: "regenerate", table })}
                  >
                    <RefreshCw size={15} />
                  </IconButton>
                  <IconButton
                    label={`Delete ${table.name}`}
                    variant="danger-ghost"
                    onClick={() => setConfirm({ type: "delete", table })}
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={!!tableModal}
        onClose={() => !saving && setTableModal(null)}
        title={tableModal?.mode === "create" ? "Add a table" : "Edit table"}
        description={tableModal?.mode === "create" ? "Fresh menu and payment QR codes are generated automatically." : "Update table details or take it out of service."}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTableModal(null)} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={saveTable} loading={saving}>{tableModal?.mode === "create" ? "Add table" : "Save changes"}</Button>
          </>
        }
      >
        {tableModal ? (
          <form className="table-form" onSubmit={saveTable}>
            <div className="form-row">
              <FormField label="Table number" htmlFor="table-number">
                <input id="table-number" type="number" min="1" max="999" className="input" value={tableModal.values.number} onChange={(event) => updateField("number", event.target.value)} required />
              </FormField>
              <FormField label="Display name" htmlFor="table-name">
                <input id="table-name" className="input" value={tableModal.values.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Table 01" required />
              </FormField>
            </div>
            {tableModal.mode === "edit" ? (
              <FormField label="Table status" htmlFor="table-status" hint="Order activity overrides this status on the floor view.">
                <Select id="table-status" value={tableModal.values.status} onChange={(event) => updateField("status", event.target.value)}>
                  {Object.entries(TABLE_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                </Select>
              </FormField>
            ) : (
              <div className="form-info">
                <QrCode size={18} />
                <p>Two unique QR codes will be created: one for the menu and one for the table's bill and payments.</p>
              </div>
            )}
          </form>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        loading={confirmLoading}
        tone={confirm?.type === "delete" ? "danger" : "warning"}
        title={confirm?.type === "regenerate" ? `Regenerate QR codes for ${confirm?.table?.name}?` : `Delete ${confirm?.table?.name}?`}
        description={
          confirm?.type === "regenerate"
            ? "The current printed QR cards will stop working immediately. You'll need to print new cards for this table."
            : "This table can only be deleted if it has no order history. Consider marking it out of service instead."
        }
        confirmLabel={confirm?.type === "regenerate" ? "Regenerate QRs" : "Delete table"}
      />
    </div>
  );
}
