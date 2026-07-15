"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus,
  X,
  CheckCircle2,
  Link2,
  Loader2,
  MapPin,
  ExternalLink,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────── */

export interface GbpLocation {
  id: string;
  name: string;
  address?: string;
}

export interface ClientConnections {
  id: string;
  hasMetaToken: boolean;
  metaAdAccountId?: string | null;
  metaPageId?: string | null;
  hasGoogleToken?: boolean;
  ga4PropertyId?: string | null;
  googleAdAccountId?: string | null;
  gbpLocations?: GbpLocation[];
  gbpLocationId?: string | null;
  gbpAccountId?: string | null;
  gbpActiveLocationId?: string | null;
  clarityProjectId?: string | null;
  // Social organico
  hasYoutubeToken?: boolean;
  youtubeChannelName?: string | null;
  hasTiktokToken?: boolean;
  tiktokDisplayName?: string | null;
  hasLinkedinToken?: boolean;
  linkedinOrgName?: string | null;
}

/* ─────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────── */

function MetaIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
    </svg>
  );
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GBPIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

function ClarityIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5L12 1zm0 4l6 2.67V11c0 3.9-2.65 7.56-6 8.93C8.65 18.56 6 14.9 6 11V7.67L12 5z" />
    </svg>
  );
}

function YoutubeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z" />
    </svg>
  );
}

function LinkedinOrgIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────── */

function ConnectedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 size={9} />
      Attivo
    </span>
  );
}

function AccountChip({
  name,
  sub,
  onRemove,
}: {
  name: string;
  sub?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 group">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{name}</p>
        {sub && (
          <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL WRAPPER
───────────────────────────────────────────────────────────────── */

function ModalWrapper({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f0f12] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: META
───────────────────────────────────────────────────────────────── */

function MetaModal({
  clientId,
  currentAdAccountId,
  currentPageId,
  hasToken,
  onClose,
  onSaved,
}: {
  clientId: string;
  currentAdAccountId?: string | null;
  currentPageId?: string | null;
  hasToken: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [token, setToken] = useState("");
  const [adAccountId, setAdAccountId] = useState(currentAdAccountId ?? "");
  const [pageId, setPageId] = useState(currentPageId ?? "");
  const [saving, setSaving] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function save() {
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const body: Record<string, string> = { metaAdAccountId: adAccountId, metaPageId: pageId };
      if (token) body.metaAccessToken = token;
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Meta Ads configurato!");
      onSaved();
      onClose();
    } catch { toast.error("Impossibile salvare. Riprova."); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrapper title="Meta Ads — Configura" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Ad Account ID</label>
          <input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="act_123456789"
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-blue-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Page ID (Facebook)</label>
          <input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="es. 104345345345"
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-blue-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
            System User Token
            {hasToken && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Già configurato</span>}
          </label>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? "Lascia vuoto per mantenere quello attuale" : "EAAB... (System User Token)"}
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-blue-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Salva configurazione Meta
        </button>
      </div>
    </ModalWrapper>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: GA4 + Google Refresh Token
───────────────────────────────────────────────────────────────── */

function GA4Modal({
  clientId, currentGa4, hasGoogleToken, onClose, onSaved,
}: {
  clientId: string; currentGa4?: string | null; hasGoogleToken?: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [ga4Id, setGa4Id] = useState(currentGa4 ?? "");
  const [refreshToken, setRefreshToken] = useState("");
  const [saving, setSaving] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function save() {
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const body: Record<string, string> = { ga4PropertyId: ga4Id };
      if (refreshToken) body.googleRefreshToken = refreshToken;
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Google Analytics configurato!");
      onSaved(); onClose();
    } catch { toast.error("Impossibile salvare."); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrapper title="Google Analytics 4" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">GA4 Property ID</label>
          <input value={ga4Id} onChange={(e) => setGa4Id(e.target.value)} placeholder="es. 345678901"
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-yellow-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
            Google OAuth Refresh Token
            {hasGoogleToken && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Già configurato</span>}
          </label>
          <input type="password" value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)}
            placeholder={hasGoogleToken ? "Lascia vuoto per mantenere" : "1//04ABCD..."}
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-yellow-500/50 transition-all placeholder:text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/60">Il token è condiviso tra Google Ads, GA4 e GBP.</p>
        </div>
        <button onClick={save} disabled={saving}
          className="w-full py-2.5 text-sm font-bold bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Salva Google Analytics
        </button>
      </div>
    </ModalWrapper>
  );
}

function GoogleAdsModal({
  clientId, currentCustomerId, hasGoogleToken, onClose, onSaved,
}: {
  clientId: string; currentCustomerId?: string | null; hasGoogleToken?: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState(currentCustomerId ?? "");
  const [saving, setSaving] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function save() {
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ googleAdAccountId: customerId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Google Ads configurato!");
      onSaved(); onClose();
    } catch { toast.error("Impossibile salvare."); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrapper title="Google Ads — Customer ID" onClose={onClose}>
      <div className="space-y-4">
        {!hasGoogleToken && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            ⚠️ Configura prima il <strong>Google OAuth Token</strong> nella card Google Analytics.
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Customer ID</label>
          <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="es. 123-456-7890"
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-blue-500/50 transition-all placeholder:text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/60">Trovalo su ads.google.com in alto a destra.</p>
        </div>
        <button onClick={save} disabled={saving || !customerId.trim()}
          className="w-full py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Salva Google Ads
        </button>
      </div>
    </ModalWrapper>
  );
}

function ClarityModal({
  clientId, currentProjectId, onClose, onSaved,
}: {
  clientId: string; currentProjectId?: string | null; onClose: () => void; onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState(currentProjectId ?? "");
  const [saving, setSaving] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function save() {
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ clarityProjectId: projectId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Microsoft Clarity configurato!");
      onSaved(); onClose();
    } catch { toast.error("Impossibile salvare."); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrapper title="Microsoft Clarity — Project ID" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Project ID</label>
          <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="es. 8abc123def"
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-violet-500/50 transition-all placeholder:text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/60">
            Trovalo su{" "}
            <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">clarity.microsoft.com</a>
            {" "}→ Impostazioni progetto.
          </p>
        </div>
        <button onClick={save} disabled={saving || !projectId.trim()}
          className="w-full py-2.5 text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Salva Clarity
        </button>
      </div>
    </ModalWrapper>
  );
}

function GbpAddModal({
  clientId, existingLocations, onClose, onSaved,
}: {
  clientId: string; existingLocations: { id: string; name: string; address: string }[]; onClose: () => void; onSaved: (locations: { id: string; name: string; address: string }[]) => void;
}) {
  const [step, setStep] = useState<"load" | "select">("load");
  const [loading, setLoading] = useState(false);
  const [apiLocations, setApiLocations] = useState<Array<{ name: string; title: string; address: string; isVerified: boolean }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function loadLocations() {
    setLoading(true);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/clients/${clientId}/gbp/locations`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Impossibile caricare le sedi. Verifica l'autenticazione Google.");
        return;
      }
      const data = await res.json();
      setApiLocations(data.locations || []);
      setStep("select");
    } catch { toast.error("Errore di rete"); }
    finally { setLoading(false); }
  }

  async function addSelected() {
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const newLocs = apiLocations
        .filter((l) => selected.includes(l.name))
        .map((l) => ({ id: l.name, name: l.title, address: l.address }));
      const merged = [...existingLocations, ...newLocs.filter((n) => !existingLocations.some((e) => e.id === n.id))];
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ gbpLocations: merged }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${newLocs.length} sede/i aggiunta/e!`);
      onSaved(merged);
      onClose();
    } catch { toast.error("Impossibile salvare."); }
    finally { setSaving(false); }
  }

  return (
    <ModalWrapper title="Google Business Profile — Aggiungi Sede" onClose={onClose}>
      {step === "load" ? (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Carica le sedi GBP associate all&apos;account Google collegato.
          </p>
          <button onClick={loadLocations} disabled={loading}
            className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            {loading ? "Caricamento..." : "Carica Sedi GBP"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{apiLocations.length} sedi trovate. Seleziona quelle da aggiungere:</p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {apiLocations.map((loc) => {
              const alreadyAdded = existingLocations.some((e) => e.id === loc.name);
              const isSelected = selected.includes(loc.name);
              return (
                <button key={loc.name} type="button" disabled={alreadyAdded}
                  onClick={() => setSelected((prev) => isSelected ? prev.filter((s) => s !== loc.name) : [...prev, loc.name])}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all cursor-pointer",
                    alreadyAdded ? "border-emerald-500/20 bg-emerald-500/5 cursor-not-allowed opacity-60"
                      : isSelected ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  )}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{loc.title}</span>
                    {(alreadyAdded || isSelected) && <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{loc.address} {loc.isVerified ? "✅" : ""}</span>
                </button>
              );
            })}
          </div>
          <button onClick={addSelected} disabled={selected.length === 0 || saving}
            className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {selected.length > 0 ? `Aggiungi ${selected.length} sede/i` : "Seleziona sedi"}
          </button>
        </div>
      )}
    </ModalWrapper>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN: PlatformConnections
───────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────
   MODAL: YOUTUBE
───────────────────────────────────────────────────────────────── */

function YoutubeModal({
  clientId, hasToken, channelName, onClose, onSaved,
}: {
  clientId: string; hasToken: boolean; channelName?: string | null;
  onClose: () => void; onSaved: (name: string) => void;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ valid: boolean; channelName?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function save() {
    if (!accessToken.trim()) { toast.error("Inserisci l'access token YouTube"); return; }
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/clients/${clientId}/youtube/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ accessToken, refreshToken: refreshToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      toast.success(`YouTube connesso — ${data.channelName}`);
      onSaved(data.channelName || "");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function checkStatus() {
    const authToken = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/clients/${clientId}/youtube/token`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    setStatus({ valid: data.valid, channelName: data.channelName });
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const authToken = localStorage.getItem("token");
      await fetch(`${API_URL}/api/clients/${clientId}/youtube/token`, {
        method: "DELETE", headers: { Authorization: `Bearer ${authToken}` },
      });
      toast.success("YouTube disconnesso");
      onSaved("");
      onClose();
    } catch { toast.error("Errore durante la disconnessione"); }
    finally { setDisconnecting(false); }
  }

  return (
    <ModalWrapper title="YouTube — Connetti canale" onClose={onClose}>
      <div className="space-y-4">
        {hasToken && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
              <div>
                <p className="text-xs font-bold text-emerald-400">Canale connesso</p>
                {channelName && <p className="text-[11px] text-muted-foreground mt-0.5">{channelName}</p>}
              </div>
            </div>
            <button onClick={checkStatus} className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer">Verifica</button>
          </div>
        )}
        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${status.valid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
            {status.valid
              ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>Token valido &mdash; {status.channelName}</>
              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>Token non valido o scaduto</>}
          </div>
        )}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground">Come ottenere il token:</p>
          <ol className="text-[10px] text-muted-foreground/70 space-y-0.5 list-decimal list-inside">
            <li>Google Cloud Console → Credenziali → OAuth 2.0</li>
            <li>Abilita YouTube Data API v3 + YouTube Analytics API</li>
            <li>Usa OAuth Playground per ottenere access + refresh token</li>
            <li>Incolla qui sotto i token</li>
          </ol>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Access Token *</label>
          <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
            placeholder={hasToken ? "Lascia vuoto per mantenere quello attuale" : "ya29.a0..."}
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-red-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Refresh Token (consigliato per rinnovo automatico)</label>
          <input value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="1//0e..."
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-red-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="flex gap-2">
          {hasToken && (
            <button onClick={disconnect} disabled={disconnecting}
              className="flex-none px-3 py-2.5 text-xs font-semibold border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50 cursor-pointer">
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : "Disconnetti"}
            </button>
          )}
          <button onClick={save} disabled={saving || !accessToken.trim()}
            className="flex-1 py-2.5 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {hasToken ? "Aggiorna token" : "Connetti YouTube"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: TIKTOK
───────────────────────────────────────────────────────────────── */

function TikTokModal({
  clientId, hasToken, displayName, onClose, onSaved,
}: {
  clientId: string; hasToken: boolean; displayName?: string | null;
  onClose: () => void; onSaved: (name: string) => void;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ valid: boolean; displayName?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function save() {
    if (!accessToken.trim()) { toast.error("Inserisci l'access token TikTok"); return; }
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/clients/${clientId}/tiktok/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ accessToken, refreshToken: refreshToken || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      toast.success(`TikTok connesso — @${data.displayName}`);
      onSaved(data.displayName || "");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function checkStatus() {
    const authToken = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/clients/${clientId}/tiktok/token`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    setStatus({ valid: data.valid, displayName: data.displayName });
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const authToken = localStorage.getItem("token");
      await fetch(`${API_URL}/api/clients/${clientId}/tiktok/token`, {
        method: "DELETE", headers: { Authorization: `Bearer ${authToken}` },
      });
      toast.success("TikTok disconnesso");
      onSaved("");
      onClose();
    } catch { toast.error("Errore durante la disconnessione"); }
    finally { setDisconnecting(false); }
  }

  return (
    <ModalWrapper title="TikTok — Connetti account" onClose={onClose}>
      <div className="space-y-4">
        {hasToken && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
              <div>
                <p className="text-xs font-bold text-emerald-400">Account connesso</p>
                {displayName && <p className="text-[11px] text-muted-foreground mt-0.5">@{displayName}</p>}
              </div>
            </div>
            <button onClick={checkStatus} className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer">Verifica</button>
          </div>
        )}
        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${status.valid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
            {status.valid
              ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>Token valido &mdash; @{status.displayName}</>
              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>Token non valido o scaduto</>}
          </div>
        )}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground">Come ottenere il token:</p>
          <ol className="text-[10px] text-muted-foreground/70 space-y-0.5 list-decimal list-inside">
            <li>developers.tiktok.com → crea app → aggiungi scopes</li>
            <li>Scopes: user.info.basic, video.list</li>
            <li>Autorizza l'account del cliente via OAuth</li>
            <li>Incolla qui access token e refresh token</li>
          </ol>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Access Token *</label>
          <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
            placeholder={hasToken ? "Lascia vuoto per mantenere quello attuale" : "act.xxx..."}
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-pink-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Refresh Token (consigliato)</label>
          <input value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="rft.xxx..."
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-pink-500/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="flex gap-2">
          {hasToken && (
            <button onClick={disconnect} disabled={disconnecting}
              className="flex-none px-3 py-2.5 text-xs font-semibold border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50 cursor-pointer">
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : "Disconnetti"}
            </button>
          )}
          <button onClick={save} disabled={saving || !accessToken.trim()}
            className="flex-1 py-2.5 text-sm font-bold bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-500 hover:to-fuchsia-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {hasToken ? "Aggiorna token" : "Connetti TikTok"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MODAL: LINKEDIN
───────────────────────────────────────────────────────────────── */

function LinkedinModal({
  clientId, hasToken, orgName, onClose, onSaved,
}: {
  clientId: string; hasToken: boolean; orgName?: string | null;
  onClose: () => void; onSaved: (name: string) => void;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ valid: boolean; orgLabel?: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  async function save() {
    if (!accessToken.trim()) { toast.error("Inserisci l'access token LinkedIn"); return; }
    setSaving(true);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/clients/${clientId}/linkedin/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          accessToken,
          refreshToken: refreshToken || undefined,
          organizationId: organizationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      toast.success(`LinkedIn connesso — ${data.userName}`);
      onSaved(organizationId || data.userName || "");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function checkStatus() {
    const authToken = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/clients/${clientId}/linkedin/token`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    setStatus({ valid: data.valid, orgLabel: data.organizationName || data.userName });
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const authToken = localStorage.getItem("token");
      await fetch(`${API_URL}/api/clients/${clientId}/linkedin/token`, {
        method: "DELETE", headers: { Authorization: `Bearer ${authToken}` },
      });
      toast.success("LinkedIn disconnesso");
      onSaved("");
      onClose();
    } catch { toast.error("Errore durante la disconnessione"); }
    finally { setDisconnecting(false); }
  }

  return (
    <ModalWrapper title="LinkedIn — Connetti pagina aziendale" onClose={onClose}>
      <div className="space-y-4">
        {hasToken && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
              <div>
                <p className="text-xs font-bold text-emerald-400">Pagina connessa</p>
                {orgName && <p className="text-[11px] text-muted-foreground mt-0.5">{orgName}</p>}
              </div>
            </div>
            <button onClick={checkStatus} className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer">Verifica</button>
          </div>
        )}
        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${status.valid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
            {status.valid
              ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>Token valido &mdash; {status.orgLabel}</>
              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>Token non valido o scaduto</>}
          </div>
        )}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <p className="text-[11px] font-bold text-muted-foreground">Come ottenere il token:</p>
          <ol className="text-[10px] text-muted-foreground/70 space-y-0.5 list-decimal list-inside">
            <li>linkedin.com/developers → crea app → prodotti: Marketing API</li>
            <li>Scopes: r_organization_social, r_organization_admin</li>
            <li>Autorizza il cliente via OAuth 2.0</li>
            <li>Incolla access token + Organization ID della pagina</li>
          </ol>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Access Token *</label>
          <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
            placeholder={hasToken ? "Lascia vuoto per mantenere quello attuale" : "AQV..."}
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-blue-600/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Refresh Token (se disponibile)</label>
          <input value={refreshToken} onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="AQW..."
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-blue-600/50 transition-all placeholder:text-muted-foreground/40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Organization ID (numero della pagina)</label>
          <input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="es. 12345678"
            className="w-full text-sm bg-background/50 border border-white/10 text-foreground px-3 py-2.5 rounded-lg outline-none focus:border-blue-600/50 transition-all placeholder:text-muted-foreground/40" />
          <p className="text-[10px] text-muted-foreground/60">Trovalo nell'URL: linkedin.com/company/<strong>12345678</strong>/admin</p>
        </div>
        <div className="flex gap-2">
          {hasToken && (
            <button onClick={disconnect} disabled={disconnecting}
              className="flex-none px-3 py-2.5 text-xs font-semibold border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50 cursor-pointer">
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : "Disconnetti"}
            </button>
          )}
          <button onClick={save} disabled={saving || !accessToken.trim()}
            className="flex-1 py-2.5 text-sm font-bold bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {hasToken ? "Aggiorna token" : "Connetti LinkedIn"}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN: PlatformConnections
───────────────────────────────────────────────────────────────── */

type ActiveModal = "meta" | "google-ads" | "ga4" | "gbp-add" | "clarity" | "youtube" | "tiktok" | "linkedin" | null;


export default function PlatformConnections({
  clientId,
  initialClient,
  onClientUpdated,
}: {
  clientId: string;
  initialClient: ClientConnections;
  onClientUpdated?: () => void;
}) {
  const [client, setClient] = useState<ClientConnections>(initialClient);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  const gbpLocations = client.gbpLocations ?? [];

  const hasGoogleToken = !!(client.hasGoogleToken || client.googleAdAccountId || client.ga4PropertyId);

  const configuredCount = [
    client.hasMetaToken || client.metaAdAccountId,
    client.ga4PropertyId,
    client.googleAdAccountId,
    gbpLocations.length > 0,
    client.clarityProjectId,
    client.hasYoutubeToken,
    client.hasTiktokToken,
    client.hasLinkedinToken,
  ].filter(Boolean).length;

  async function removeGbpLocation(locationId: string) {
    const updated = gbpLocations.filter((l) => l.id !== locationId);
    try {
      const authToken = localStorage.getItem("token");
      await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ gbpLocations: updated }),
      });
      setClient((prev) => ({ ...prev, gbpLocations: updated }));
      toast.success("Sede rimossa");
    } catch { toast.error("Errore durante la rimozione"); }
  }

  function refreshClient() {
    onClientUpdated?.();
  }

  function cardStyle(active: boolean, color: string) {
    return {
      borderColor: active ? `${color}40` : "rgba(255,255,255,0.07)",
      background: active ? `${color}0a` : "rgba(255,255,255,0.015)",
    };
  }

  function iconStyle(color: string) {
    return { background: `${color}22`, color };
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">
            Connessioni <span className="text-primary">Piattaforme</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Collega i tuoi strumenti di marketing per sincronizzare i dati in automatico.
          </p>
        </div>
        <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2 shrink-0">
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn("w-2 h-2 rounded-full transition-all duration-300", i < configuredCount ? "bg-emerald-400" : "bg-white/10")} />
            ))}
          </div>
          <span className="text-xs font-bold text-muted-foreground">{configuredCount}/8 configurate</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(!!client.hasMetaToken || !!client.metaAdAccountId, "#1877F2")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={iconStyle("#60a5fa")}>
                <MetaIcon />
              </div>
              <span className="text-sm font-bold text-foreground">Meta Ads</span>
            </div>
            {client.hasMetaToken && <ConnectedBadge />}
          </div>
          <button type="button" onClick={() => setActiveModal("meta")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-blue-500/20 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 transition-all cursor-pointer">
            {client.hasMetaToken ? <><ExternalLink size={11} /> Modifica configurazione</> : <><Link2 size={11} /> Collega Meta Ads</>}
          </button>
        </div>

        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(!!client.googleAdAccountId, "#4285F4")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                <GoogleIcon />
              </div>
              <span className="text-sm font-bold text-foreground">Google Ads</span>
            </div>
            {client.googleAdAccountId && <ConnectedBadge />}
          </div>
          <button type="button" onClick={() => setActiveModal("google-ads")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-blue-400/20 text-blue-300 bg-blue-400/5 hover:bg-blue-400/10 transition-all cursor-pointer">
            {client.googleAdAccountId ? <><ExternalLink size={11} /> Modifica</> : <><Link2 size={11} /> Collega Google Ads</>}
          </button>
        </div>

        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(!!client.ga4PropertyId, "#F9AB00")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5">
                <GoogleIcon />
              </div>
              <div>
                <span className="text-sm font-bold text-foreground">Analytics</span>
                <span className="ml-1.5 text-[10px] font-bold text-yellow-500/70 bg-yellow-500/10 px-1.5 py-0.5 rounded">GA4</span>
              </div>
            </div>
            {client.ga4PropertyId && <ConnectedBadge />}
          </div>
          <button type="button" onClick={() => setActiveModal("ga4")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-yellow-500/20 text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all cursor-pointer">
            {client.ga4PropertyId ? <><ExternalLink size={11} /> Modifica</> : <><Link2 size={11} /> Collega Analytics</>}
          </button>
        </div>

        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(gbpLocations.length > 0, "#34A853")}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={iconStyle("#4ade80")}>
                <GBPIcon />
              </div>
              <span className="text-sm font-bold text-foreground">GBP</span>
            </div>
            {gbpLocations.length > 0 && <ConnectedBadge />}
          </div>
          <button type="button" onClick={() => setActiveModal("gbp-add")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all cursor-pointer">
            <Plus size={11} />
            {gbpLocations.length > 0 ? "Aggiungi un'altra sede" : "Collega Sede GBP"}
          </button>
        </div>

        {/* ── MICROSOFT CLARITY ── */}
        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(!!client.clarityProjectId, "#7719AA")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={iconStyle("#c084fc")}>
                <ClarityIcon />
              </div>
              <span className="text-sm font-bold text-foreground">Clarity</span>
            </div>
            {client.clarityProjectId && <ConnectedBadge />}
          </div>
          {client.clarityProjectId && <AccountChip name={client.clarityProjectId} sub="Heatmaps attive" />}
          <button type="button" onClick={() => setActiveModal("clarity")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-violet-500/20 text-violet-400 bg-violet-500/5 hover:bg-violet-500/10 transition-all cursor-pointer">
            {client.clarityProjectId ? <><ExternalLink size={11} /> Modifica</> : <><Link2 size={11} /> Collega Clarity</>}
          </button>
        </div>

        {/* ── YOUTUBE ── */}
        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(!!client.hasYoutubeToken, "#FF0000")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={iconStyle("#f87171")}>
                <YoutubeIcon />
              </div>
              <span className="text-sm font-bold text-foreground">YouTube</span>
            </div>
            {client.hasYoutubeToken && <ConnectedBadge />}
          </div>
          {client.youtubeChannelName && <AccountChip name={client.youtubeChannelName} sub="Canale connesso" />}
          <button type="button" onClick={() => setActiveModal("youtube")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer">
            {client.hasYoutubeToken ? <><ExternalLink size={11} /> Modifica / Verifica</> : <><Link2 size={11} /> Collega YouTube</>}
          </button>
        </div>

        {/* ── TIKTOK ── */}
        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(!!client.hasTiktokToken, "#fe2c55")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", color: "#f0f0f0" }}>
                <TikTokIcon />
              </div>
              <span className="text-sm font-bold text-foreground">TikTok</span>
            </div>
            {client.hasTiktokToken && <ConnectedBadge />}
          </div>
          {client.tiktokDisplayName && <AccountChip name={`@${client.tiktokDisplayName}`} sub="Account connesso" />}
          <button type="button" onClick={() => setActiveModal("tiktok")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-pink-500/20 text-pink-400 bg-pink-500/5 hover:bg-pink-500/10 transition-all cursor-pointer">
            {client.hasTiktokToken ? <><ExternalLink size={11} /> Modifica / Verifica</> : <><Link2 size={11} /> Collega TikTok</>}
          </button>
        </div>

        {/* ── LINKEDIN ── */}
        <div className="rounded-2xl border p-5 space-y-3 transition-all duration-200" style={cardStyle(!!client.hasLinkedinToken, "#0A66C2")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={iconStyle("#60a5fa")}>
                <LinkedinOrgIcon />
              </div>
              <span className="text-sm font-bold text-foreground">LinkedIn</span>
            </div>
            {client.hasLinkedinToken && <ConnectedBadge />}
          </div>
          {client.linkedinOrgName && <AccountChip name={client.linkedinOrgName} sub="Pagina aziendale" />}
          <button type="button" onClick={() => setActiveModal("linkedin")}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-lg border border-blue-600/20 text-blue-400 bg-blue-600/5 hover:bg-blue-600/10 transition-all cursor-pointer">
            {client.hasLinkedinToken ? <><ExternalLink size={11} /> Modifica / Verifica</> : <><Link2 size={11} /> Collega LinkedIn</>}
          </button>
        </div>

      </div>

      {/* ── MODALS ── */}
      {activeModal === "meta" && (
        <MetaModal clientId={clientId} currentAdAccountId={client.metaAdAccountId} currentPageId={client.metaPageId}
          hasToken={client.hasMetaToken} onClose={() => setActiveModal(null)}
          onSaved={() => { refreshClient(); setActiveModal(null); }} />
      )}
      {activeModal === "google-ads" && (
        <GoogleAdsModal clientId={clientId} currentCustomerId={client.googleAdAccountId}
          hasGoogleToken={hasGoogleToken} onClose={() => setActiveModal(null)}
          onSaved={() => { refreshClient(); setActiveModal(null); }} />
      )}
      {activeModal === "ga4" && (
        <GA4Modal clientId={clientId} currentGa4={client.ga4PropertyId}
          hasGoogleToken={hasGoogleToken} onClose={() => setActiveModal(null)}
          onSaved={() => { refreshClient(); setActiveModal(null); }} />
      )}
      {activeModal === "gbp-add" && (
        <GbpAddModal clientId={clientId} existingLocations={gbpLocations}
          onClose={() => setActiveModal(null)}
          onSaved={(locations) => setClient((prev) => ({ ...prev, gbpLocations: locations }))} />
      )}
      {activeModal === "clarity" && (
        <ClarityModal clientId={clientId} currentProjectId={client.clarityProjectId}
          onClose={() => setActiveModal(null)}
          onSaved={() => { refreshClient(); setActiveModal(null); }} />
      )}
      {activeModal === "youtube" && (
        <YoutubeModal
          clientId={clientId}
          hasToken={!!client.hasYoutubeToken}
          channelName={client.youtubeChannelName}
          onClose={() => setActiveModal(null)}
          onSaved={(name) => {
            setClient((prev) => ({ ...prev, hasYoutubeToken: !!name, youtubeChannelName: name || null }));
            setActiveModal(null);
          }}
        />
      )}
      {activeModal === "tiktok" && (
        <TikTokModal
          clientId={clientId}
          hasToken={!!client.hasTiktokToken}
          displayName={client.tiktokDisplayName}
          onClose={() => setActiveModal(null)}
          onSaved={(name) => {
            setClient((prev) => ({ ...prev, hasTiktokToken: !!name, tiktokDisplayName: name || null }));
            setActiveModal(null);
          }}
        />
      )}
      {activeModal === "linkedin" && (
        <LinkedinModal
          clientId={clientId}
          hasToken={!!client.hasLinkedinToken}
          orgName={client.linkedinOrgName}
          onClose={() => setActiveModal(null)}
          onSaved={(name) => {
            setClient((prev) => ({ ...prev, hasLinkedinToken: !!name, linkedinOrgName: name || null }));
            setActiveModal(null);
          }}
        />
      )}
    </div>
  );
}
