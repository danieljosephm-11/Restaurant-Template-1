import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Check,
  Copy,
  CreditCard,
  Globe2,
  ImagePlus,
  IndianRupee,
  Info,
  KeyRound,
  Landmark,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  UploadCloud,
  WalletCards,
  X,
} from "lucide-react";
import { useApiQuery, useDocumentTitle } from "../../hooks/useApiQuery.js";
import { api } from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";
import { classNames } from "../../lib/format.js";
import {
  Button,
  FormField,
  Skeleton,
  Spinner,
} from "../../components/ui.jsx";

const EMPTY = {
  name: "",
  tagline: "",
  logo: "",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  taxPercent: 5,
  serviceChargePercent: 0,
  upiVpa: "",
  upiName: "",
  currency: "INR",
};

export default function AdminSettingsPage() {
  useDocumentTitle("Settings");
  const toast = useToast();
  const { data, loading, error, refetch } = useApiQuery("/admin/settings");
  const [form, setForm] = useState(EMPTY);
  const [initial, setInitial] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [environment, setEnvironment] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (data) {
      const next = { ...EMPTY, ...data.settings };
      setForm(next);
      setInitial(next);
      setEnvironment(data.environment);
    }
  }, [data]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleLogo(event) {
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
      setField("logo", result.url);
      toast.success("Logo uploaded. Save changes to publish it.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save(event) {
    event?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        tagline: form.tagline,
        logo: form.logo,
        address: form.address,
        phone: form.phone,
        email: form.email || null,
        gstin: form.gstin,
        taxPercent: Number(form.taxPercent),
        serviceChargePercent: Number(form.serviceChargePercent),
        upiVpa: form.upiVpa,
        upiName: form.upiName,
      };
      const result = await api("/admin/settings", { method: "PUT", body: payload });
      const next = { ...EMPTY, ...result.settings };
      setForm(next);
      setInitial(next);
      setEnvironment(result.environment);
      toast.success("Restaurant settings saved.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyAppUrl() {
    try {
      await navigator.clipboard.writeText(environment?.appUrl || "");
      setCopied(true);
      toast.info("App URL copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the URL.");
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__head"><Skeleton width={260} height={40} /></div>
        <div className="settings-grid">
          <Skeleton height={540} radius={18} />
          <Skeleton height={420} radius={18} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error-panel"><h2>Couldn't load settings</h2><p>{error.message}</p><Button variant="primary" onClick={() => refetch()}>Try again</Button></div>
      </div>
    );
  }

  return (
    <div className="admin-page admin-settings-page">
      <header className="admin-page__head">
        <div>
          <span className="admin-page__eyebrow"><Store size={13} /> Restaurant profile</span>
          <h1>Make it yours.</h1>
          <p>These details appear on the guest menu, QR cards and every digital bill.</p>
        </div>
        <div className="admin-page__actions">
          {dirty ? <span className="unsaved-pill"><span /> Unsaved changes</span> : null}
          <Button variant="primary" size="sm" icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
        </div>
      </header>

      <form className="settings-grid" onSubmit={save}>
        <div className="settings-main">
          <section className="admin-panel settings-panel">
            <div className="admin-panel__head">
              <div>
                <span className="admin-panel__eyebrow">Profile</span>
                <h2>Restaurant identity</h2>
              </div>
              <Building2 size={18} className="panel__icon" />
            </div>

            <div className="settings-brand-row">
              <div className="settings-logo">
                {form.logo ? (
                  <img src={form.logo} alt="Restaurant logo" />
                ) : (
                  <span>{form.name ? form.name.slice(0, 2).toUpperCase() : "SD"}</span>
                )}
              </div>
              <div className="settings-logo__actions">
                <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()} loading={uploading}>
                  {form.logo ? "Replace logo" : "Upload logo"}
                </Button>
                {form.logo ? (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setField("logo", "")}>Remove</Button>
                ) : null}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleLogo} />
                <small>Square image works best · JPG, PNG or WebP · max 3 MB</small>
              </div>
            </div>

            <div className="form-row">
              <FormField label="Restaurant name" htmlFor="settings-name">
                <input id="settings-name" className="input" value={form.name} onChange={(event) => setField("name", event.target.value)} required />
              </FormField>
              <FormField label="Tagline" htmlFor="settings-tagline" optional>
                <input id="settings-tagline" className="input" value={form.tagline || ""} onChange={(event) => setField("tagline", event.target.value)} placeholder="Modern Indian kitchen" />
              </FormField>
            </div>

            <FormField label="Address" htmlFor="settings-address">
              <span className="input-with-icon input-with-icon--top">
                <MapPin size={16} />
                <textarea id="settings-address" className="input textarea" rows={2} value={form.address || ""} onChange={(event) => setField("address", event.target.value)} />
              </span>
            </FormField>

            <div className="form-row">
              <FormField label="Phone" htmlFor="settings-phone">
                <span className="input-with-icon"><Phone size={16} /><input id="settings-phone" className="input" value={form.phone || ""} onChange={(event) => setField("phone", event.target.value)} /></span>
              </FormField>
              <FormField label="Email" htmlFor="settings-email" optional>
                <span className="input-with-icon"><Mail size={16} /><input id="settings-email" type="email" className="input" value={form.email || ""} onChange={(event) => setField("email", event.target.value)} /></span>
              </FormField>
            </div>
            <FormField label="GSTIN" htmlFor="settings-gstin" optional hint="15-character GST identification number printed on invoices.">
              <span className="input-with-icon"><ReceiptText size={16} /><input id="settings-gstin" className="input" value={form.gstin || ""} onChange={(event) => setField("gstin", event.target.value.toUpperCase())} maxLength={15} /></span>
            </FormField>
          </section>

          <section className="admin-panel settings-panel">
            <div className="admin-panel__head">
              <div>
                <span className="admin-panel__eyebrow">Billing</span>
                <h2>Taxes & charges</h2>
              </div>
              <IndianRupee size={18} className="panel__icon" />
            </div>
            <div className="form-row form-row--three">
              <FormField label="GST percentage" htmlFor="settings-tax" hint="Applied to the subtotal at checkout.">
                <span className="input-suffix"><input id="settings-tax" type="number" min="0" max="28" step="0.5" className="input" value={form.taxPercent} onChange={(event) => setField("taxPercent", event.target.value)} /><span>%</span></span>
              </FormField>
              <FormField label="Service charge" htmlFor="settings-service" hint="Optional. Set to 0 to disable.">
                <span className="input-suffix"><input id="settings-service" type="number" min="0" max="20" step="0.5" className="input" value={form.serviceChargePercent} onChange={(event) => setField("serviceChargePercent", event.target.value)} /><span>%</span></span>
              </FormField>
              <FormField label="Currency" htmlFor="settings-currency" hint="Set at the database level.">
                <input id="settings-currency" className="input" value={form.currency || "INR"} disabled />
              </FormField>
            </div>
            <div className="settings-info">
              <Info size={15} />
              <p>Changing tax or service charge affects new orders only. Historical bills keep the rates they were placed with.</p>
            </div>
          </section>

          <section className="admin-panel settings-panel">
            <div className="admin-panel__head">
              <div>
                <span className="admin-panel__eyebrow">Payments</span>
                <h2>UPI collection details</h2>
              </div>
              <WalletCards size={18} className="panel__icon" />
            </div>
            <div className="form-row">
              <FormField label="UPI ID (VPA)" htmlFor="settings-upi" hint="The merchant ID encoded into dynamic payment QR codes.">
                <span className="input-with-icon"><Landmark size={16} /><input id="settings-upi" className="input" value={form.upiVpa || ""} onChange={(event) => setField("upiVpa", event.target.value)} placeholder="restaurant@bank" /></span>
              </FormField>
              <FormField label="UPI display name" htmlFor="settings-upi-name" hint="Shown in the guest's UPI app.">
                <input id="settings-upi-name" className="input" value={form.upiName || ""} onChange={(event) => setField("upiName", event.target.value)} placeholder={form.name} />
              </FormField>
            </div>
            <div className="settings-info settings-info--warning">
              <ShieldCheck size={15} />
              <p>Keep this UPI ID accurate before going live. In demo mode the payment is simulated and no money moves.</p>
            </div>
          </section>
        </div>

        <aside className="settings-aside">
          <section className={classNames("admin-panel", "environment-card", environment?.paymentMode === "demo" && "is-demo")}>
            <div className="admin-panel__head">
              <div>
                <span className="admin-panel__eyebrow">Runtime</span>
                <h2>Environment</h2>
              </div>
              <Globe2 size={18} className="panel__icon" />
            </div>
            <div className="environment-row">
              <span>Payment mode</span>
              <span className={`environment-mode is-${environment?.paymentMode}`}>
                <span /> {environment?.paymentMode === "demo" ? "Demo / simulated" : "Live gateway"}
              </span>
            </div>
            <div className="environment-row">
              <span>Public app URL</span>
              <div className="environment-url">
                <code>{environment?.appUrl || "—"}</code>
                <button type="button" onClick={copyAppUrl} aria-label="Copy app URL">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
              </div>
            </div>
            <p className="environment-hint">
              The app URL is embedded inside every QR code. Set <code>APP_URL</code> in <code>.env</code> to your LAN or
              production address before printing cards.
            </p>
            <div className="environment-status">
              <span><Check size={12} /> Database connected</span>
              <span><Check size={12} /> Realtime ready</span>
            </div>
          </section>

          <section className="admin-panel security-card">
            <div className="admin-panel__head">
              <div>
                <span className="admin-panel__eyebrow">Production checklist</span>
                <h2>Before you go live</h2>
              </div>
              <LockKeyhole size={18} className="panel__icon" />
            </div>
            <ul className="security-list">
              <li><span><KeyRound size={14} /></span><div><strong>Replace JWT_SECRET</strong><p>Use a long random value, not the demo fallback.</p></div></li>
              <li><span><ShieldCheck size={14} /></span><div><strong>Switch to Razorpay</strong><p>Set PAYMENT_MODE=razorpay and add signed webhook secrets.</p></div></li>
              <li><span><Globe2 size={14} /></span><div><strong>Set the public APP_URL</strong><p>Use HTTPS so QR links and webhooks work everywhere.</p></div></li>
              <li><span><CreditCard size={14} /></span><div><strong>Verify your UPI details</strong><p>Make a small live test payment before service.</p></div></li>
            </ul>
          </section>

          <section className="admin-panel settings-tip-card">
            <Sparkles size={19} />
            <div>
              <strong>Need to reprint QR cards?</strong>
              <p>Every table's menu and payment QR codes live under Tables & QR.</p>
              <a href="/admin/tables" className="text-link">Open tables <ArrowRightSmall /></a>
            </div>
          </section>

          {dirty ? (
            <div className="settings-save-dock">
              <div><strong>Unsaved changes</strong><span>Review and save to publish.</span></div>
              <Button variant="primary" size="sm" onClick={save} loading={saving} icon={Save}>Save</Button>
            </div>
          ) : null}
        </aside>
      </form>
    </div>
  );
}

function ArrowRightSmall() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
