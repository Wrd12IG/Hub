"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  Globe,
  Plus,
  FileText,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Download,
  TrendingUp,
  Image as ImageIcon,
  Trash2,
  BarChart2,
  Share2,
  Youtube,
  Instagram,
  Music,
  Linkedin,
  Facebook,
  Video,
  Lightbulb,
  Filter,
  Users,
  Eye,
  LayoutDashboard,
  Activity,
  PlayCircle,
  MapPin,
  Calendar,
  Sparkles,
  Heart,
  MousePointerClick,
  ExternalLink,
  GripVertical,
  Clock,
  Search,
  Link as LinkIcon,
  Star,
  MessageSquare,
  MonitorPlay,
  MousePointer2,
  PieChart,
  LayoutGrid,
  CalendarDays,
  Settings,
  FileBarChart,
  BarChart3,
  Swords,
} from "lucide-react";
import { useLayoutData } from "@/app/(app)/layout-context";
import { MarketingReportTab } from "@/components/MarketingReportTab";
import { ReportSummaryStrip } from "@/components/ReportSummaryStrip";
import { ReportTrendCard } from "@/components/ReportTrendCard";
import { validateRange, rangeLabel } from "@/lib/date-range";
import { PeriodPicker } from "@/components/PeriodPicker";
import { useMarketingReport } from "@/hooks/use-marketing-report";
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { stripCitations } from "@/lib/clean-text";
import { CampaignsTable } from "@/components/CampaignsTable";
import { CompetitorAdLibrary } from "@/components/CompetitorAdLibrary";
import { ClientHealthBadge } from "@/components/ClientHealthBadge";
import { CompetitorsSection } from "@/components/CompetitorsSection";
import { CompetitivePressureSection } from "@/components/CompetitivePressureSection";
import MetaCampaignReportModal from "@/components/MetaCampaignReportModal";
import dynamic from "next/dynamic";
const SeoAuditModal = dynamic(
  () => import("@/components/SeoAuditModal").then((m) => m.SeoAuditModal),
  { ssr: false },
);
import { MetaTokenManager } from "@/components/MetaTokenManager";
import PlatformConnections from "@/components/PlatformConnections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MetricoolDatePicker } from "@/components/metricool/MetricoolDatePicker";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mergeCompetitors } from "@/lib/competitor-merge";
import { computeAdsHealth, overallAdsHealth } from "@/lib/ads-health";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Nessun dato placeholder — tutti i dati sono reali da Firebase / API collegate

interface Client {
  id: string;
  name: string;
  websiteUrl: string;
  socialManagerId?: string | null;
  creativeMode: string;
  targetCPA: number | null;
  targetROAS: number | null;
  industry: string | null;
  metaAdAccountId: string;
  metaPageId: string;
  metaPixelId: string | null;
  hasMetaToken: boolean;
  lastAuditScore: number | null;
  lastSeoScore?: number | null;
  lastSeoAuditAt?: string | null;
  lastAuditWaste: number | null;
  lastAuditAt: string | null;
  lastAuditPdfUrl: string | null;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    dailyBudget: number;
    launchedAt: string | null;
    _count: { adVariants: number };
  }>;
  brandAssets: Array<{
    id: string;
    type: string;
    format: string;
    label: string;
    isActive: boolean;
  }>;
  intelligence?: {
    productDescription: string;
    uniqueValueProp: string;
    priceRange: string | null;
    businessType: string;
    targetDescription: string;
    targetAgeMin: number;
    targetAgeMax: number;
    targetGender: string;
    targetPainPoints: string[];
    targetTriggers: string[];
    territoryType: string;
    territoryCities: string[];
    territoryRegions: string[];
    territoryNotes: string | null;
    competitors: any[];
    metaInterests: string[];
    metaBehaviors: string[];
    metaLookalike: string | null;
    analysisNotes: string | null;
    confidenceScore: number;
    websiteScraped: boolean;
  } | null;
  ga4PropertyId?: string | null;
  clarityProjectId?: string | null;
  googleAdAccountId?: string | null;
  gbpLocationId?: string | null; // legacy — single location
  gbpAccountId?: string | null;
  gbpLocations?: Array<{ id: string; name: string; address?: string }>; // multi-sede
  gbpActiveLocationId?: string | null; // sede attiva
  // Social integration flags (populated at runtime by the API route)
  hasYoutubeToken?: boolean;
  youtubeChannelName?: string | null;
  youtubePublicChannelId?: string | null;
  youtubePublicChannelName?: string | null;
  hasTiktokToken?: boolean;
  tiktokDisplayName?: string | null;
  hasLinkedinToken?: boolean;
  linkedinOrgName?: string | null;
  windsorAccounts?: {
    instagram?: string;
    searchconsole?: string;
    linkedin_organic?: string;
    gbp?: string[];
  };
}

const statusColors: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  DRAFT: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", label: "Bozza" },
  PENDING_REVIEW: {
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.1)",
    label: "In Review",
  },
  APPROVED: {
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.1)",
    label: "Approvata",
  },
  LIVE: { color: "#34d399", bg: "rgba(52,211,153,0.1)", label: "Live" },
  PAUSED: { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "In Pausa" },
  COMPLETED: {
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.1)",
    label: "Completata",
  },
  FAILED: { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "Fallita" },
};


export default function ClientDetailPage() {
  const { id } = useParams() as { id: string };
  const { usersById } = useLayoutData();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "intelligence"
    | "campaigns"
    | "settings"
    | "heatmaps"
  >("overview");
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [uploadingVisionIndex, setUploadingVisionIndex] = useState<
    number | null
  >(null);
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);

  // Unified Meta + Google Ads campaign list for the "Campagne" tab (see
  // app/api/clients/[id]/campaigns/route.ts).
  const [allCampaigns, setAllCampaigns] = useState<{
    id: string; platform: 'meta' | 'google_ads'; name: string;
    status: 'active' | 'paused' | 'ended'; objective?: string;
    startDate?: string; endDate?: string;
    spend: number; impressions: number; clicks: number; conversions: number;
  }[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | 'active' | 'paused' | 'ended'>('all');
  // Same DateRange + MetricoolDatePicker the Instagram/Facebook/LinkedIn pages
  // use, rather than native <input type="date"> which looked foreign here.
  const [campaignRange, setCampaignRange] = useState<DateRange | undefined>(undefined);
  const campaignDateFrom = campaignRange?.from ? format(campaignRange.from, 'yyyy-MM-dd') : '';
  const campaignDateTo = campaignRange?.to ? format(campaignRange.to, 'yyyy-MM-dd') : '';
  const [reportModalData, setReportModalData] = useState<any | null>(null);
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [reportModalDatePreset, setReportModalDatePreset] =
    useState<string>("last_30d");
  const [isReportRefreshing, setIsReportRefreshing] = useState(false);
  const [seoReportOpen, setSeoReportOpen] = useState(false);
  const [seoReportsList, setSeoReportsList] = useState<any[]>([]);
  const [isReportsOpen, setIsReportsOpen] = useState(false);

  const [allClients, setAllClients] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [campaignFilter, setCampaignFilter] = useState("");
  const [ga4Data, setGa4Data] = useState<any | null>(null);
  const [loadingGa4, setLoadingGa4] = useState(false);
  const [editingDomain, setEditingDomain] = useState(false);
  const [domainDraft, setDomainDraft] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  const saveDomain = async () => {
    const raw = domainDraft.trim();
    // vuoto = rimuove il dominio; altrimenti normalizza con https://
    const websiteUrl = raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, "") : "";
    if (websiteUrl && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(websiteUrl)) {
      toast.error("Dominio non valido (es. www.esempio.it)");
      return;
    }
    setSavingDomain(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ websiteUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setClient((c) => (c ? { ...c, websiteUrl } : c));
      setEditingDomain(false);
      toast.success(websiteUrl ? "Dominio salvato" : "Dominio rimosso");
    } catch (e) {
      console.error("[domain] save failed:", e);
      toast.error("Impossibile salvare il dominio. Riprova.");
    } finally {
      setSavingDomain(false);
    }
  };
  const [overviewDaysBack, setOverviewDaysBack] = useState(30);
  // Periodo scelto a mano: due date. Vale solo se è valido; finché non lo è, resta l'ultimo periodo buono.
  const [periodMode, setPeriodMode] = useState<"preset" | "custom">("preset");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const customCheck = periodMode === "custom" ? validateRange(customFrom, customTo) : null;
  const activeRange = customCheck?.ok ? customCheck.range : null;
  /** I giorni del periodo in uso: quelli del menu, oppure la durata dell'intervallo scelto. */
  const effectiveDays = customCheck?.ok ? customCheck.days : overviewDaysBack;
  const [compareMode, setCompareMode] = useState("prev_period");
  // Un solo caricamento del report, condiviso fra il riepilogo in cima e le schede delle piattaforme
  const marketingReport = useMarketingReport(id as string, effectiveDays, compareMode as "prev_period" | "prev_year" | "none", activeTab === "overview", activeRange);
  const [ga4Properties, setGa4Properties] = useState<
    {
      propertyId: string;
      displayName: string;
      websiteUrl: string;
      accountName: string;
    }[]
  >([]);
  const [loadingGa4Props, setLoadingGa4Props] = useState(false);
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<
    { id: string; name: string; formattedId: string }[]
  >([]);
  const [loadingGoogleAdsAccounts, setLoadingGoogleAdsAccounts] =
    useState(false);
  const [metaAdAccounts, setMetaAdAccounts] = useState<
    { id: string; name: string; currency: string; account_status: number }[]
  >([]);
  const [loadingMetaAccounts, setLoadingMetaAccounts] = useState(false);
  const [gbpLocations, setGbpLocations] = useState<
    { name: string; title: string; address: string; isVerified: boolean }[]
  >([]);
  const [gbpAccounts, setGbpAccounts] = useState<
    { name: string; accountName: string; type: string }[]
  >([]);
  const [loadingGbpLocations, setLoadingGbpLocations] = useState(false);

  useEffect(() => {
    if (id) {
      const saved = localStorage.getItem(`meta_filter_${id}`);
      if (saved) setCampaignFilter(saved);
    }
  }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/api/clients`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => r.json())
      .then((data) => setAllClients(data))
      .catch(() => {});
  }, []);

  const handleOpenReport = async (
    campaignId: string,
    objective: string,
    campaignName: string,
    preset: string = "last_30d",
  ) => {
    if (
      loadingReportId &&
      loadingReportId === campaignId &&
      !isReportRefreshing
    )
      return;

    if (reportModalData) setIsReportRefreshing(true);
    else setLoadingReportId(campaignId);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/clients/${id}/meta/campaigns/${campaignId}/insights?objective=${objective}&datePreset=${preset}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to load insights");
      const data = await res.json();
      setReportModalData({ ...data, campaignId, campaignName, objective });
      setReportModalDatePreset(preset);
    } catch (e) {
      toast.error(
        "Impossibile caricare il report. Controlla che la campagna abbia generato traffico.",
      );
      if (!reportModalData) setReportModalData(null);
    } finally {
      setLoadingReportId(null);
      setIsReportRefreshing(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitorName.trim() || !client) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_URL}/api/clients/${client.id}/intelligence/competitors`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: newCompetitorName }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`);
      setNewCompetitorName("");
      window.location.reload();
    } catch (e: any) {
      console.error("[competitor] Error adding competitor:", e);
      toast.error(e.message || "Impossibile aggiungere il competitor. Riprova.");
    }
  };

  // Aggiunge al monitoraggio notturno UN solo competitor, quello scelto: l'aggiunta in blocco prendeva i primi dell'elenco
  // che entravano nei 5 posti, e un altro poteva passare davanti a quello che volevi.
  const handleMonitorOne = async (index: number) => {
    if (!client?.intelligence) return;
    const c: any = (client.intelligence.competitors ?? [])[index];
    if (!c) return;
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      const current = await fetch(`${API_URL}/api/clients/${client.id}/competitors`, { headers });
      if (!current.ok) throw new Error(`HTTP ${current.status}`);
      const existing = (await current.json()).competitors ?? [];
      const plan = mergeCompetitors(existing, [{ name: c.name ?? c.nome, url: c.url ?? c.website ?? c.sito }]);
      const nome = c.name ?? c.nome ?? "Competitor";
      if (plan.skippedNoUrl.length) return void toast.error(`${nome} non ha un sito: aggiungilo prima, il Hub legge il sito ogni notte.`);
      if (plan.skippedDuplicate.length) return void toast.message(`${nome} è già monitorato`, { description: "C'è già un competitor con lo stesso sito o lo stesso nome." });
      if (plan.skippedFull.length) return void toast.error("Elenco pieno: 5 competitor su 5", { description: "Togline uno da Setup API → Competitor per fare posto." });
      const res = await fetch(`${API_URL}/api/clients/${client.id}/competitors`, {
        method: "POST", headers, body: JSON.stringify({ competitors: plan.merged }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`${nome} aggiunto al monitoraggio notturno`, { description: plan.added[0]?.sito });
    } catch (e: any) {
      toast.error(e.message || "Impossibile aggiungere il competitor");
    }
  };

  // Porta i concorrenti trovati dall'analisi AI nel monitoraggio notturno (Setup API → Competitor)
  const handleSaveToMonitoring = async () => {
    if (!client?.intelligence) return;
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      const current = await fetch(`${API_URL}/api/clients/${client.id}/competitors`, { headers });
      if (!current.ok) throw new Error(`HTTP ${current.status}`);
      const existing = (await current.json()).competitors ?? [];

      const incoming = (client.intelligence.competitors ?? []).map((c: any) => ({
        name: c.name ?? c.nome, url: c.url ?? c.website ?? c.sito,
      }));
      const plan = mergeCompetitors(existing, incoming);
      const skipped = [
        plan.skippedNoUrl.length ? `senza sito: ${plan.skippedNoUrl.join(", ")}` : "",
        plan.skippedDuplicate.length ? `già monitorati: ${plan.skippedDuplicate.join(", ")}` : "",
        plan.skippedFull.length ? `oltre il limite di 5: ${plan.skippedFull.join(", ")}` : "",
      ].filter(Boolean).join(" · ");

      if (plan.added.length === 0) {
        toast.message("Nessun competitor da aggiungere", { description: skipped || "L'elenco è vuoto." });
        return;
      }
      // I siti li ha proposti l'AI: vanno controllati prima che il Hub inizi a leggerli ogni notte
      const lista = plan.added.map((a) => `• ${a.nome} — ${a.sito}`).join("\n");
      if (!window.confirm(`Aggiungere al monitoraggio notturno?\n\n${lista}\n\nI siti sono proposti dall'AI: controlla che siano quelli giusti.`)) return;

      const res = await fetch(`${API_URL}/api/clients/${client.id}/competitors`, {
        method: "POST", headers, body: JSON.stringify({ competitors: plan.merged }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(`Aggiunti ${plan.added.length} competitor al monitoraggio`, { description: skipped || undefined });
    } catch (e: any) {
      console.error("[competitor] Error saving to monitoring:", e);
      toast.error(e.message || "Impossibile salvare i competitor");
    }
  };

  const handleDeleteCompetitor = async (index: number) => {
    if (!client) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      console.error("[competitor] Error deleting competitor:", e);
      toast.error(e.message || "Impossibile eliminare il competitor. Riprova.");
    }
  };

  // Cerca i concorrenti veri (Claude + web); il server verifica che ogni sito esista prima di salvarlo
  const handleDiscoverCompetitors = async () => {
    if (!client) return;
    setIsDiscovering(true);
    try {
      const res = await fetch(`${API_URL}/api/clients/${client.id}/intelligence/competitors/discover`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
      if (data.warning) toast.warning(data.warning);
      else toast.success(`Trovati ${data.added} nuovi competitor verificati`, {
        description: [
          data.updated ? `${data.updated} schede completate con punti di forza e deboli` : "",
          data.removed ? `${data.removed} voci generiche senza sito tolte` : "",
          data.source === "claude" ? "Ricerca web non disponibile: controlla i nomi" : "",
        ].filter(Boolean).join(" · ") || undefined,
      });
      if (data.added > 0 || data.removed > 0 || data.updated > 0) window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Ricerca competitor non riuscita");
    } finally {
      setIsDiscovering(false);
    }
  };

  // Riduce lo screenshot (max 1600 px, JPEG): resta sotto il limite di 4,5 MB delle funzioni Vercel e costa meno token
  const shrinkImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("Immagine non leggibile")); }
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Immagine non leggibile")); };
      img.src = url;
    });

  // Punti di forza e deboli con ricerca web e fonti (30-50 secondi)
  const handleAnalyzeCompetitor = async (index: number) => {
    if (!client) return;
    setAnalyzingIndex(index);
    try {
      const res = await fetch(
        `${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}/analyze`,
        { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Errore ${res.status}`);
      toast.success(data.competitor?.weakness ? "Analisi completata" : "Analisi completata: nessuna lacuna verificabile");
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Analisi non riuscita");
    } finally {
      setAnalyzingIndex(null);
    }
  };

  const handleScreenshotUpload = async (index: number, file: File) => {
    if (!client || !file) return;
    setUploadingVisionIndex(index);
    try {
      const base64Image = await shrinkImage(file);
      const res = await fetch(
        `${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}/vision`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ base64Image }),
        },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      console.error("[vision] Error uploading screenshot:", e);
      toast.error(e.message || "Impossibile analizzare lo screenshot. Riprova.");
    } finally {
      setUploadingVisionIndex(null);
    }
  };


  useEffect(() => {
    const fetchClient = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/clients/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 404) {
            setFetchError(
              "Cliente non trovato nel database. Crea un nuovo cliente dalla pagina clienti.",
            );
          } else if (res.status === 401) {
            setFetchError("Sessione scaduta. Effettua nuovamente il login.");
          } else {
            setFetchError(`Errore server (${res.status}). Riprova più tardi.`);
          }
          return;
        }
        const data = await res.json();
        setClient(data);

        // La pagina si sblocca appena il cliente è arrivato: campagne (Windsor,
        // lente) e report SEO partono in background, senza `await`.
        setLoading(false);

        setLoadingCampaigns(true);
        fetch(`${API_URL}/api/clients/${id}/campaigns`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(async (r) => {
            if (r.ok) setAllCampaigns((await r.json()).campaigns || []);
          })
          .catch((e) => console.error("Failed to load unified campaigns", e))
          .finally(() => setLoadingCampaigns(false));

        fetch(`${API_URL}/api/clients/${id}/seo-reports`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(async (r) => {
            if (r.ok) setSeoReportsList((await r.json()) || []);
          })
          .catch((e) => console.error("Failed to load seo reports", e));
      } catch (err) {
        setFetchError(
          "Impossibile connettersi al backend. Verifica che il server sia in esecuzione su " +
            API_URL,
        );
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id]);

  useEffect(() => {
    if (!client?.ga4PropertyId) return;
    const fetchGa4 = async () => {
      setLoadingGa4(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${API_URL}/api/clients/${id}/analytics?${activeRange ? `from=${activeRange.from}&to=${activeRange.to}` : `dateRange=${overviewDaysBack}d`}&compare=${compareMode}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (res.ok && !data.notConfigured) {
          setGa4Data(data);
        } else {
          setGa4Data(null);
        }
      } catch (e) {
        console.error("Failed to fetch GA4 data", e);
        setGa4Data(null);
      } finally {
        setLoadingGa4(false);
      }
    };
    fetchGa4();
  }, [client?.ga4PropertyId, overviewDaysBack, compareMode, id, activeRange?.from, activeRange?.to]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">
          Caricamento cliente...
        </span>
      </div>
    );

  if (fetchError || !client)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <div className="text-5xl opacity-30"></div>
        <h2 className="text-xl font-bold text-destructive">
          Cliente non trovato
        </h2>
        <p className="text-muted-foreground max-w-sm">
          {fetchError || "Il client ID richiesto non esiste nel database."}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Tutti i clienti
            </Link>
          </Button>
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="h-4 w-4 mr-2" />
              Crea Nuovo Cliente
            </Link>
          </Button>
        </div>
        {allClients.length > 0 && (
          <div className="mt-2 p-4 border rounded-xl w-full max-w-sm">
            <p className="text-sm text-muted-foreground mb-2 font-semibold">
              Oppure seleziona un altro cliente:
            </p>
            <Select
              onValueChange={(v) => {
                window.location.href = `/clients/${v}`;
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="-- Scegli dal menu --" />
              </SelectTrigger>
              <SelectContent>
                {[...allClients].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-semibold">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );

  // Health Score Ads: derived from the campaigns already fetched for the
  // Campagne tab, so it costs no extra request. See lib/ads-health.ts for the
  // (deliberately transparent) formula.
  const adsHealth = computeAdsHealth(allCampaigns);
  const adsHealthOverall = overallAdsHealth(adsHealth);

  const tabs = [
    { id: "overview", label: "Overview & Audit", icon: LayoutDashboard, iconColor: "text-amber-500" },
    { id: "intelligence", label: "AI Intelligence", icon: Brain, iconColor: "text-purple-400" },
    {
      id: "campaigns",
      label: `Campagne${allCampaigns.length > 0 ? ` (${allCampaigns.length})` : ''}`,
      icon: Target,
      iconColor: "text-emerald-400",
    },
    { id: "heatmaps", label: "Heatmaps & Registrazioni", icon: Eye, iconColor: "text-rose-400" },
    { id: "settings", label: "Setup API", icon: Settings, iconColor: "text-amber-400" },
  ];

  // Calcolo reale traffico social da GA4
  const socialChannels =
    ga4Data?.traffic?.channels?.filter(
      (c: any) =>
        (c?.channel || "").toLowerCase().includes("social") ||
        (c?.channel || "").toLowerCase().includes("video"),
    ) || [];
  const totalSocialSessions = socialChannels.reduce(
    (sum: number, c: any) => sum + (c.sessions || 0),
    0,
  );
  const socialConvs =
    ga4Data?.conversions?.byChannel?.filter((c: any) =>
      (c?.channel || "").toLowerCase().includes("social"),
    ) || [];
  const totalSocialConversions = socialConvs.reduce(
    (sum: number, c: any) => sum + (c.conversions || 0),
    0,
  );
  const socialCvr =
    totalSocialSessions > 0
      ? ((totalSocialConversions / totalSocialSessions) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between bg-white/[0.01] border border-white/5 p-6 rounded-2xl shadow-sm">
        {/* LEFT: back + title */}
        <div className="space-y-3">
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Tutti i clienti
          </Link>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-foreground font-headline">
                {client.name}
              </h1>
              {/* Come sta andando il cliente, in una faccia e un numero. Guarda
                  solo il risultato (esito vs 30 giorni precedenti); setup ads,
                  SEO e impression share sono le cause, nel pannello al click.
                  Il perché di questa scelta: lib/client-health.ts. */}
              <ClientHealthBadge clientId={id as string} adsHealthOverall={adsHealthOverall} />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
              {client.websiteUrl && (
                <a
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                >
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  {(client?.websiteUrl || "").replace(/^https?:\/\//, "")}
                </a>
              )}
              {client.socialManagerId && usersById[client.socialManagerId] && (
                <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full text-xs font-semibold">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Social Manager: {usersById[client.socialManagerId].name}
                </div>
              )}
              {client.industry && (
                <Badge
                  variant="secondary"
                  className="font-bold rounded-lg border border-white/5 bg-white/5 px-2 py-0.5 text-xs"
                >
                  {client.industry}
                </Badge>
              )}
              {client.creativeMode && (
                <Badge
                  variant="outline"
                  className="font-bold rounded-lg border-white/10 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  Modalità: {client.creativeMode}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: azione. Il cambio cliente sta nell'intestazione (ClientSwitcher, con ricerca): qui c'era un secondo
            selettore «Passa a:» che faceva la stessa cosa ricaricando la pagina. */}
        <div className="flex flex-col gap-3 items-start sm:items-end shrink-0">
          <Button
            asChild
            size="sm"
            className="active:scale-[0.97] transition-transform rounded-xl font-bold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/10"
          >
            <Link href={`/clients/${id}/meta-ads/new`}>
              <Plus className="h-4 w-4 mr-1.5" /> Nuova Campagna
            </Link>
          </Button>
        </div>
      </div>

      {/* ── QUICK LINKS ──────────────────────────────────────────────────
          Raggruppati per intenzione: prima il lavoro sul cliente, poi la
          creatività, poi l'analisi. Otto pill tutte uguali mescolavano cose
          che non si fanno nello stesso momento.

          Due sono state tolte perché portavano dove si era già:
          • "Calendario" apriva la stessa pagina di "Piano Editoriale", solo
            con la vista calendario preselezionata — vista che quella pagina
            offre già con un click al suo interno.
          • "Maps & GBP" duplicava la scheda GBP che ora sta nella Overview,
            da cui si raggiunge il dettaglio per sede.
      ── */}
      <div className="relative z-20 flex flex-wrap items-center gap-2.5 bg-white/[0.01] border border-white/5 p-4 rounded-2xl shadow-sm">
        {[
          {
            href: `/clients/${id}/editorial-plan`,
            icon: CalendarDays,
            label: "Piano Editoriale",
            dot: "bg-pink-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
          },
          {
            href: `/clients/${id}/tasks`,
            icon: CheckCircle2,
            label: "Tasks",
            dot: "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]",
          },
          {
            href: `/clients/${id}/projects`,
            icon: LayoutGrid,
            label: "Progetti",
            dot: "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]",
          },
          { separator: true },
          {
            href: `/clients/${id}/creative`,
            icon: Sparkles,
            label: "Creative Lab",
            dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
          },
          {
            // Pagina globale: il cliente viaggia nell'URL, così si apre già
            // filtrata invece di partire da "tutti".
            href: `/documents?tab=media&client=${id}`,
            icon: ImageIcon,
            label: "Creative Board",
            dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]",
          },
          { separator: true },
          {
            href: `/reports?client=${id}`,
            icon: TrendingUp,
            label: "Growth Report",
            dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
          },
        ].map((item, i) => {
          if ('separator' in item) {
            return <span key={`sep-${i}`} aria-hidden className="h-6 w-px bg-white/10 mx-1" />;
          }
          const { href, icon: Icon, label, dot } = item;
          return (
            <Link
              key={href}
              href={href}
              className="relative z-10 cursor-pointer glass-card inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/5 bg-white/[0.02] hover:bg-white/[0.07] hover:border-white/10 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95 text-foreground"
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
              <Icon className="h-3.5 w-3.5 text-muted-foreground/80" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* ── TAB BAR ── */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto scrollbar-hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-all duration-200 flex items-center gap-2",
                  "border-b-2 -mb-px active:scale-[0.98]",
                  activeTab === tab.id
                    ? "border-primary text-foreground bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30",
                )}
              >
                <Icon className={cn("h-4 w-4 transition-colors", tab.iconColor)} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-8">
          {/* CONTROL BAR: Date Filter & Comparazione */}
          <div className="glass-card flex flex-col md:flex-row md:justify-between md:items-center p-4 rounded-2xl gap-4 border border-white/10 bg-white/[0.03] shadow-md">
            <PeriodPicker
              mode={periodMode}
              daysBack={overviewDaysBack}
              from={customFrom}
              to={customTo}
              check={customCheck}
              onPreset={(d) => { setPeriodMode("preset"); setOverviewDaysBack(d); }}
              onCustom={(r) => { setCustomFrom(r.from); setCustomTo(r.to); setPeriodMode("custom"); }}
              onFrom={setCustomFrom}
              onTo={setCustomTo}
            />

            <div className="flex items-center gap-3">
              <div className="text-sm font-bold text-muted-foreground">
                Compara con:
              </div>
              <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
                <button
                  onClick={() => setCompareMode("prev_period")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 active:scale-[0.95]",
                    compareMode === "prev_period"
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                  )}
                >
                  Periodo Prec.
                </button>
                <button
                  onClick={() => setCompareMode("prev_year")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 active:scale-[0.95]",
                    compareMode === "prev_year"
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                  )}
                >
                  Anno Prec.
                </button>
                <button
                  onClick={() => setCompareMode("none")}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200 active:scale-[0.95]",
                    compareMode === "none"
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                  )}
                >
                  Nessuno
                </button>
              </div>
            </div>
          </div>

          {/* RIEPILOGO: spesa, risultato, costo per risultato, anomalie */}
          <ReportSummaryStrip
            report={marketingReport}
            days={effectiveDays}
            compare={compareMode as "prev_period" | "prev_year" | "none"}
          />

          {/* ANDAMENTO: spesa e risultato per giorno */}
          <ReportTrendCard report={marketingReport} days={effectiveDays} periodText={activeRange ? rangeLabel(activeRange.from, activeRange.to) : undefined} />

          {/* ==================================================== */}
          {/* PERFORMANCE PER ACCOUNT (dati delle piattaforme collegate)  */}
          {/* Sostituisce le vecchie sezioni alimentate dalla       */}
          {/* pipeline n8n (clients/{id}/performance), mai popolata */}
          {/* ==================================================== */}
          <CollapsibleCard
            icon={BarChart3}
            title="Performance per account"
            description="Dati delle piattaforme collegate per il periodo selezionato."
          >
            <MarketingReportTab
              clientId={id as string}
              compare={compareMode as 'prev_period' | 'prev_year' | 'none'}
              report={marketingReport}
            />
          </CollapsibleCard>

          {/* BENTO GRID: Overview Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* CARD 1: Domain Performance (GA4) - Spans 2 cols on lg */}
            <CollapsibleCard
              className="lg:col-span-2"
              icon={Globe}
              title="Performance dominio"
              description={client.websiteUrl?.replace("https://", "") || "Nessun dominio"}
              actions={
                editingDomain ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveDomain();
                    }}
                  >
                    <Input
                      autoFocus
                      value={domainDraft}
                      onChange={(e) => setDomainDraft(e.target.value)}
                      placeholder="www.esempio.it"
                      className="h-8 w-56"
                    />
                    <Button type="submit" size="sm" disabled={savingDomain}>
                      {savingDomain ? "Salvo…" : "Salva"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingDomain(false)}
                    >
                      Annulla
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDomainDraft(client.websiteUrl || "");
                      setEditingDomain(true);
                    }}
                  >
                    {client.websiteUrl ? "Modifica" : "Imposta dominio"}
                  </Button>
                )
              }
            >
              {/* WEB ANALYTICS COMPLETO */}
              {loadingGa4 ? (
                <div className="bg-white/[0.01] p-8 rounded-xl text-center flex flex-col items-center justify-center min-h-[120px] gap-2 border border-dashed border-white/10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground animate-pulse">
                    Elaborazione Report Godmode GA4 e calcolo deltas storici...
                  </span>
                </div>
              ) : !client.ga4PropertyId ? (
                <div className="bg-primary/5 border border-dashed border-primary/20 p-6 rounded-xl text-center space-y-3">
                  <div className="text-sm font-semibold text-primary">
                    Google Analytics Non Collegato
                  </div>
                  <div className="text-xs text-muted-foreground max-w-md mx-auto">
                    Collega il Property ID di GA4 in "Setup API" per sbloccare
                    l'intelligenza contestuale avanzata sul traffico.
                  </div>
                  <Button onClick={() => setActiveTab("settings")} size="sm">
                    Configura Analytics
                  </Button>
                </div>
              ) : ga4Data ? (
                <div className="space-y-6">
                  {/* Traffic Category */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                      Traffico & Acquisizione
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {
                          label: "Sessioni Totali",
                          metric: ga4Data.traffic?.sessions,
                          format: (v: number) => v.toLocaleString(),
                        },
                        {
                          label: "Utenti Unici",
                          metric: ga4Data.traffic?.users,
                          format: (v: number) => v.toLocaleString(),
                        },
                        {
                          label: "Nuovi Utenti",
                          metric: ga4Data.traffic?.newUsers,
                          format: (v: number) => v.toLocaleString(),
                        },
                        {
                          label: "Utenti di Ritorno",
                          metric: ga4Data.traffic?.returningUsers,
                          format: (v: number) => v.toLocaleString(),
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="glass-card hover:bg-white/[0.06] hover:border-white/15 p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col justify-between min-h-[95px] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                        >
                          <div className="text-xs font-bold text-muted-foreground/75 uppercase tracking-wider truncate">
                            {item.label}
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-xl font-extrabold tracking-tight text-foreground">
                              {item.metric ? item.format(item.metric.val) : "0"}
                            </span>
                            {item.metric && (
                              <span
                                className={cn(
                                  "text-xs font-extrabold px-1.5 py-0.5 rounded shadow-sm",
                                  item.metric.chg > 0
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : item.metric.chg < 0
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-white/5 text-muted-foreground",
                                )}
                              >
                                {item.metric.chg > 0 ? "+" : ""}
                                {item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Behavior Category */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                      Comportamento On-Site
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {
                          label: "Bounce Rate",
                          metric: ga4Data.behavior?.bounceRate,
                          format: (v: number) => `${v.toFixed(1)}%`,
                        },
                        {
                          label: "Engagement Rate",
                          metric: ga4Data.behavior?.engagementRate,
                          format: (v: number) => `${v.toFixed(1)}%`,
                        },
                        {
                          label: "Pagine / Sessione",
                          metric: ga4Data.behavior?.pagesPerSession,
                          format: (v: number) => v.toFixed(2),
                        },
                        {
                          label: "Tempo Medio (s)",
                          metric: ga4Data.behavior?.avgSessionDuration,
                          format: (v: number) => `${v.toFixed(0)} s`,
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="glass-card hover:bg-white/[0.06] hover:border-white/15 p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col justify-between min-h-[95px] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                        >
                          <div className="text-xs font-bold text-muted-foreground/75 uppercase tracking-wider truncate">
                            {item.label}
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-xl font-extrabold tracking-tight text-foreground">
                              {item.metric ? item.format(item.metric.val) : "0"}
                            </span>
                            {item.metric && (
                              <span
                                className={cn(
                                  "text-xs font-extrabold px-1.5 py-0.5 rounded shadow-sm",
                                  item.metric.chg > 0
                                    ? "bg-rose-500/10 text-rose-400"
                                    : item.metric.chg < 0
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-white/5 text-muted-foreground",
                                )}
                              >
                                {item.metric.chg > 0 ? "+" : ""}
                                {item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Conversions Category */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                      Conversioni ({activeRange ? rangeLabel(activeRange.from, activeRange.to) : `ultimi ${overviewDaysBack}gg`} vs prec.)
                    </h4>
                    {(["transactions", "revenue"] as const).every(
                      (k) => ga4Data.conversions?.[k]?.val === 0 && ga4Data.conversions?.[k]?.chg === 0,
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        Nessun acquisto online tracciato: acquisti e revenue non vengono mostrati. Per questo cliente il risultato
                        sono i lead (vedi il riepilogo in alto).
                      </p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {
                          label: "Conversioni Totali",
                          metric: ga4Data.conversions?.totalConversions,
                          format: (v: number) => v.toLocaleString(),
                        },
                        {
                          label: "Tasso di Conversione",
                          metric: ga4Data.conversions?.conversionRate,
                          format: (v: number) => `${v.toFixed(2)}%`,
                        },
                        {
                          label: "Acquisti (Transazioni)",
                          metric: ga4Data.conversions?.transactions,
                          format: (v: number) => v.toLocaleString(),
                          hideIfZero: true,
                        },
                        {
                          label: "Revenue Generato",
                          metric: ga4Data.conversions?.revenue,
                          format: (v: number) => `€${v.toLocaleString()}`,
                          hideIfZero: true,
                        },
                      ]
                        // Acquisti e revenue a zero in entrambi i periodi (val 0 e variazione 0): il cliente non vende online,
                        // quei riquadri sono solo rumore. Il suo risultato sono i lead (vedi il riepilogo in alto).
                        .filter((item: any) => !(item.hideIfZero && item.metric && item.metric.val === 0 && item.metric.chg === 0))
                        .map((item, i) => (
                        <div
                          key={i}
                          className="glass-card hover:bg-white/[0.06] hover:border-white/15 p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col justify-between min-h-[95px] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                        >
                          <div className="text-xs font-bold text-muted-foreground/75 uppercase tracking-wider truncate">
                            {item.label}
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-xl font-extrabold tracking-tight text-foreground">
                              {item.metric ? item.format(item.metric.val) : "0"}
                            </span>
                            {item.metric && (
                              <span
                                className={cn(
                                  "text-xs font-extrabold px-1.5 py-0.5 rounded shadow-sm",
                                  item.metric.chg > 0
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : item.metric.chg < 0
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-white/5 text-muted-foreground",
                                )}
                              >
                                {item.metric.chg > 0 ? "+" : ""}
                                {item.metric.chg}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </CollapsibleCard>

            {/* CARD 2: Health Score Ads — calcolato sui dati campagne reali */}
            <CollapsibleCard
              icon={Activity}
              title="Health Score Ads"
              description="Su campagne Meta e Google Ads del periodo selezionato"
              summary={
                adsHealthOverall !== null ? (
                  <span className={cn(
                    "text-xl font-black",
                    adsHealthOverall >= 80 ? "text-emerald-400" : adsHealthOverall >= 60 ? "text-amber-400" : "text-rose-400",
                  )}>
                    {adsHealthOverall}<span className="text-xs font-bold text-muted-foreground/60"> / 100</span>
                  </span>
                ) : undefined
              }
            >
              {loadingCampaigns ? (
                <div className="text-xs text-muted-foreground/60 animate-pulse">Calcolo in corso...</div>
              ) : adsHealth.length === 0 ? (
                <div className="text-xs text-muted-foreground bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  Nessuna campagna Meta o Google Ads trovata. Collega le piattaforme in &quot;Setup API&quot;.
                </div>
              ) : (
                <div className="space-y-3">
                  {adsHealth.map((h) => (
                    <div key={h.platform} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{h.label}</span>
                        <span
                          className={cn(
                            "text-sm font-black",
                            h.score === null ? "text-muted-foreground"
                              : h.score >= 80 ? "text-emerald-400"
                              : h.score >= 60 ? "text-amber-400"
                              : "text-rose-400",
                          )}
                        >
                          {h.score === null ? "n/d" : `${h.score}/100`}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {h.factors.map((f) => (
                          <li
                            key={f.id}
                            className={cn(
                              "text-xs leading-snug",
                              f.applicable ? "text-muted-foreground" : "text-muted-foreground/40 italic",
                            )}
                          >
                            <span className="font-semibold">{f.label}</span> ({f.weight}%): {f.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleCard>

            {/* CARD 3: SEO Godmode Generator - Spans 2 cols on lg */}
            <CollapsibleCard
              className="lg:col-span-2"
              icon={Sparkles}
              title="Audit SEO"
              description="Performance e Core Web Vitals reali da Google PageSpeed, più i dati di Search Console."
              summary={
                typeof client.lastSeoScore === "number" ? (
                  <span className={cn(
                    "text-xl font-black",
                    client.lastSeoScore >= 80 ? "text-emerald-400" : client.lastSeoScore >= 60 ? "text-amber-400" : "text-rose-400",
                  )}>
                    {client.lastSeoScore}<span className="text-xs font-bold text-muted-foreground/60"> / 100</span>
                  </span>
                ) : undefined
              }
            >
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2">
                  <Button
                    onClick={() => setSeoReportOpen(true)}
                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white border-0 py-4.5 px-6 rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {typeof client.lastSeoScore === "number" ? "Apri audit SEO" : "Esegui audit SEO"}
                  </Button>

                  {seoReportsList.length > 0 && (
                    <div className="w-full sm:w-64 border border-white/10 rounded-xl overflow-hidden bg-background/40 backdrop-blur-md">
                      <div
                        onClick={() => setIsReportsOpen(!isReportsOpen)}
                        className="flex justify-between items-center p-3 cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <span className="text-xs font-bold text-foreground">
                          Archivio Report ({seoReportsList.length})
                        </span>
                        <span
                          className={cn(
                            "text-xs transition-transform duration-200 text-muted-foreground",
                            isReportsOpen && "transform rotate-180",
                          )}
                        >
                          ▼
                        </span>
                      </div>
                      {isReportsOpen && (
                        <div className="p-3 pt-0 flex flex-col gap-1.5 border-t border-white/5 max-h-32 overflow-y-auto scrollbar-thin">
                          {seoReportsList.map((report) => (
                            <div
                              key={report.id}
                              className="flex justify-between items-center p-2 bg-white/[0.02] hover:bg-white/[0.05] rounded-lg text-xs transition-colors border border-white/5"
                            >
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <FileText className="h-3 w-3" />
                                <span>
                                  {new Date(
                                    report.createdAt,
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="font-extrabold text-emerald-400">
                                Score: {report.overallScore}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
            </CollapsibleCard>

            {/* CARD 4: Collegamenti dati. Prima mostrava «Token Meta mancante» guardando hasMetaToken, ma i dati Meta
                arrivano da Windsor col solo ID account: l'avviso compariva anche con tutto funzionante. */}
            {(() => {
              const sources = [
                { label: "Meta Ads", ok: !!client.metaAdAccountId },
                { label: "Google Ads", ok: !!client.googleAdAccountId },
                { label: "Google Analytics 4", ok: !!client.ga4PropertyId },
                { label: "Search Console", ok: !!client.windsorAccounts?.searchconsole },
                { label: "Google Business Profile", ok: (client.windsorAccounts?.gbp?.length ?? 0) > 0 },
                { label: "Instagram", ok: !!client.windsorAccounts?.instagram },
              ];
              const missing = sources.filter((x) => !x.ok).length;
              return (
                <CollapsibleCard
                  icon={AlertTriangle}
                  title="Collegamenti dati"
                  description="Quali fonti sono collegate a questo cliente"
                  summary={
                    <span className={cn("text-xs font-semibold", missing === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                      {sources.length - missing} di {sources.length}
                    </span>
                  }
                >
                  <ul className="divide-y divide-border rounded-lg border border-border bg-background">
                    {sources.map((x) => (
                      <li key={x.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{x.label}</span>
                        <span className={cn("text-xs font-semibold", x.ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                          {x.ok ? "Collegato" : "Non collegato"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {missing > 0 && (
                    <Button onClick={() => setActiveTab("settings")} size="sm" variant="outline" className="h-8 text-xs font-semibold">
                      Collega le fonti mancanti in Setup API
                    </Button>
                  )}
                </CollapsibleCard>
              );
            })()}
          </div>

          {/* Pressione competitiva: l'unico dato competitivo *numerico* che le
              API espongano. Segue il selettore "Periodo" perché è una metrica
              di periodo, a differenza del registro competitor qui sotto. */}
          <CollapsibleCard
            icon={Swords}
            title="Pressione competitiva"
            description="Quota di ricerche su Google Ads e annunci attivi dei competitor su Meta, Google e LinkedIn."
          >
            <CompetitivePressureSection clientId={id as string} daysBack={effectiveDays} range={activeRange} />
            <CompetitorAdLibrary clientId={id as string} />
          </CollapsibleCard>

          {/* Competitor: cosa fanno i concorrenti sul territorio. Non segue il
              selettore "Periodo" perché non è una metrica di periodo — è un
              registro di cambiamenti osservati, con la loro data. */}
          <CollapsibleCard
            icon={Users}
            title="Competitor"
            description="Cosa cambia sui siti dei concorrenti, letto ogni notte."
          >
            <CompetitorsSection clientId={id as string} />
          </CollapsibleCard>
        </div>
      )}

      {/* TAB: INTELLIGENCE */}
      {activeTab === "intelligence" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {!client.intelligence ? (
              <div className="glass-card p-10 text-center rounded-2xl border border-white/10 bg-white/[0.03] shadow-md">
                <Brain
                  size={48}
                  className="opacity-20 mx-auto mb-4 text-cyan-400"
                />
                <h3 className="text-lg font-bold mb-2">
                  Nessuna Analisi AI Disponibile
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  L'AI non ha ancora analizzato il sito web di questo cliente
                  per estrarre target, competitor e interessi.
                </p>
                <button
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerHTML = "Analisi in corso (fino a 1 minuto)...";
                    try {
                      const token = localStorage.getItem("token");
                      // Il server legge nome e sito dal cliente salvato: il corpo non serve
                      const res = await fetch(
                        `${API_URL}/api/clients/${client.id}/intelligence/analyze`,
                        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
                      );
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error || "Analisi non riuscita");
                      toast.success("Analisi completata");
                      window.location.reload();
                    } catch (err: any) {
                      // Prima l'errore veniva ignorato e la pagina si ricaricava uguale: sembrava che il pulsante non facesse nulla
                      toast.error(err.message);
                      btn.disabled = false;
                      btn.innerHTML = "Esegui Analisi Sito";
                    }
                  }}
                  className="btn-gorgeous px-6 py-2.5 text-sm font-semibold active:scale-95 transition-all"
                >
                  Esegui Analisi Sito
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* USP e Prodotto */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col gap-4 shadow-md">
                  <div className="flex items-center gap-3">
                    <Target className="text-amber-400" size={20} />
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">
                      Prodotto & USP
                    </h3>
                    {client.intelligence.websiteScraped && (
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                         Sito Analizzato
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Prodotto:</strong>{" "}
                    {client.intelligence.productDescription}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">USP:</strong>{" "}
                    {client.intelligence.uniqueValueProp}
                  </div>
                  <div className="flex gap-3 mt-1">
                    <div className="bg-white/5 px-3 py-1.5 rounded-xl text-xs border border-white/5 font-semibold">
                      <span className="text-muted-foreground/80">Tipo: </span>
                      <strong className="text-amber-400">
                        {client.intelligence.businessType}
                      </strong>
                    </div>
                    <div className="bg-white/5 px-3 py-1.5 rounded-xl text-xs border border-white/5 font-semibold">
                      <span className="text-muted-foreground/80">Ticket: </span>
                      <strong className="text-emerald-400">
                        {client.intelligence.priceRange || "Sconosciuto"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Target Avatar */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="text-cyan-400" size={20} />
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">
                      Target Avatar
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-6">
                    {client.intelligence.targetDescription}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-black text-rose-400 mb-3 uppercase tracking-widest">
                        I loro problemi (Pain Points)
                      </h4>
                      <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground/90">
                        {client.intelligence.targetPainPoints.map(
                          (p: string, i: number) => (
                            <li key={i}>{p}</li>
                          ),
                        )}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-400 mb-3 uppercase tracking-widest">
                        Leve Acquisto (Triggers)
                      </h4>
                      <ul className="list-disc pl-4 space-y-1.5 text-xs text-muted-foreground/90">
                        {client.intelligence.targetTriggers.map(
                          (t: string, i: number) => (
                            <li key={i}>{t}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Competitor */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] shadow-md space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Target className="text-pink-400" size={20} />
                      <h3 className="text-base font-extrabold text-foreground tracking-tight">
                        Competitor & Ads Library (Vision AI)
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleDiscoverCompetitors}
                      disabled={isDiscovering}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDiscovering ? "Ricerca in corso (fino a 1 minuto)..." : "Trova competitor veri (AI + web)"}
                    </button>
                    {client.intelligence.competitors?.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSaveToMonitoring}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-pink-500/30 text-pink-400 bg-pink-500/5 hover:bg-pink-500/10 transition-all cursor-pointer"
                      >
                        Aggiungi tutti al monitoraggio (max 5)
                      </button>
                    )}
                  </div>

                  {/* Lista Competitor */}
                  {!client.intelligence.competitors ||
                  client.intelligence.competitors.length === 0 ? (
                    <p className="text-muted-foreground/70 text-xs mb-2">
                      Nessun competitor rilevato o aggiunto.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-5 mb-4">
                      {client.intelligence.competitors.map(
                        (c: any, i: number) => {
                          const firstLetter = c.name?.charAt(0) || "?";
                          return (
                            <div
                              key={i}
                              className="glass-card border-l-4 border-l-pink-500/50 bg-white/[0.02] p-6 rounded-2xl border border-white/5 shadow-md flex flex-col gap-4 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-pink-500/5 transition-all duration-300"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/20 text-pink-400 font-extrabold text-base flex items-center justify-center shadow-sm">
                                    {firstLetter}
                                  </div>
                                  <div className="space-y-0.5">
                                    <h4 className="font-extrabold text-foreground text-sm sm:text-base tracking-tight">
                                      {c.name}
                                    </h4>
                                    {(c.url || c.city) && (
                                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                        {c.url && (
                                          <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
                                            {String(c.url).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                                          </a>
                                        )}
                                        {c.city && <span>· {c.city}</span>}
                                        {c.verified && <span className="text-emerald-400 font-semibold">· sito verificato</span>}
                                      </div>
                                    )}
                                    {c.estimatedBudget && (
                                      <Badge
                                        variant="secondary"
                                        className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold px-2 py-0.5 rounded-md"
                                      >
                                        Budget: {c.estimatedBudget}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-start gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleMonitorOne(i)}
                                  title="Aggiungi solo questo competitor al monitoraggio notturno"
                                  className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-pink-500/30 text-pink-600 dark:text-pink-400 bg-pink-500/5 hover:bg-pink-500/10 transition-all cursor-pointer"
                                >
                                  Monitora
                                </button>
                                <button
                                  onClick={() => handleDeleteCompetitor(i)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all active:scale-95 cursor-pointer border-none"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white/[0.02] border border-white/8 p-3.5 rounded-xl space-y-1 border-l-2 border-l-emerald-500/60">
                                  <div className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3 w-3" /> Punti
                                    di forza
                                  </div>
                                  <div className="text-xs text-muted-foreground leading-relaxed font-medium">
                                    {c.strength ? stripCitations(String(c.strength)) : "—"}
                                  </div>
                                </div>
                                <div className="bg-white/[0.02] border border-white/8 p-3.5 rounded-xl space-y-1 border-l-2 border-l-rose-500/60">
                                  <div className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3" /> Punti
                                    deboli
                                  </div>
                                  <div className="text-xs text-muted-foreground leading-relaxed font-medium">
                                    {c.weakness ? stripCitations(String(c.weakness)) : (
                                      <span className="italic text-muted-foreground/60">
                                        {c.analysisNote
                                          ? `Analizzato: ${stripCitations(String(c.analysisNote))}`
                                          : "Non ancora analizzato: non vuol dire che non ce ne siano."}
                                      </span>
                                    )}
                                    {Array.isArray(c.weaknessSources) && c.weaknessSources.length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                        {c.weaknessSources.map((u: string, k: number) => (
                                          <a key={k} href={u} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground/70 underline hover:text-foreground">
                                            fonte {k + 1}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleAnalyzeCompetitor(i)}
                                      disabled={analyzingIndex !== null}
                                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 disabled:opacity-50 cursor-pointer border-none bg-transparent p-0"
                                    >
                                      {analyzingIndex === i ? "Ricerca sul web in corso (fino a 1 minuto)…" : c.analyzedAt ? "Rianalizza con ricerca web" : "Analizza con ricerca web"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white/[0.01] border border-white/5 p-3.5 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-3.5 w-3.5 text-pink-400" />
                                  <span className="text-muted-foreground/75 font-bold">
                                    Stile Creativo:
                                  </span>
                                  <span className="text-foreground font-semibold">
                                    {c.adStyle ? stripCitations(String(c.adStyle)) : "Non ancora analizzato."}
                                  </span>
                                </div>
                                {c.adAnalysis && (
                                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                                    {([["Angoli", c.adAnalysis.angles], ["Ganci", c.adAnalysis.hooks], ["Call to action", c.adAnalysis.ctas], ["Offerte", c.adAnalysis.offers]] as const).map(
                                      ([label, items]) => (items?.length ?? 0) > 0 && (
                                        <div key={label}>
                                          <div className="font-bold text-muted-foreground/75 mb-1">{label}</div>
                                          <ul className="list-disc list-inside space-y-0.5 text-foreground">
                                            {items.map((it: string, k: number) => <li key={k}>{it}</li>)}
                                          </ul>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Vision Upload Box */}
                              <div className="p-4 bg-white/[0.01] rounded-xl border border-dashed border-white/10 hover:border-white/20 transition-colors flex flex-col gap-3 relative group/upload">
                                <div className="flex items-center gap-2">
                                  <Brain className="h-4 w-4 text-indigo-400" />
                                  <span className="text-xs font-bold text-foreground">
                                    Analisi Inserzioni Attive (Screenshot AI)
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed m-0">
                                  Carica uno screenshot della Facebook Ads
                                  Library del competitor. Claude
                                  analizzerà l'immagine per dedurre angoli, hook
                                  e ganci creativi usati.
                                </p>

                                <label
                                  htmlFor={`screenshot-upload-${i}`}
                                  className="flex flex-col items-center justify-center p-4 border border-dashed border-white/10 rounded-lg cursor-pointer hover:bg-white/[0.04] hover:border-primary/30 transition-all duration-300"
                                >
                                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold">
                                    <ImageIcon className="h-4 w-4" />
                                    <span>Scegli o trascina un'immagine</span>
                                  </div>
                                  <input
                                    id={`screenshot-upload-${i}`}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      if (e.target.files?.[0])
                                        handleScreenshotUpload(
                                          i,
                                          e.target.files[0],
                                        );
                                    }}
                                    className="hidden"
                                  />
                                </label>

                                {uploadingVisionIndex === i && (
                                  <div className="text-primary text-xs font-bold flex items-center gap-1.5 mt-1 animate-pulse">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>
                                       Lettura dello screenshot in corso... (fino a 1 minuto)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}

                  {/* Add Manual Competitor */}
                  <div className="flex gap-2 items-center bg-white/5 p-3 rounded-xl border border-white/5">
                    <input
                      type="text"
                      placeholder="Aggiungi nome concorrente (es. Sephora)"
                      value={newCompetitorName}
                      onChange={(e) => setNewCompetitorName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddCompetitor()
                      }
                      className="flex-1 bg-background/50 border border-white/10 hover:border-white/20 focus:border-primary/50 text-foreground px-3 py-2 rounded-lg text-xs outline-none transition-all placeholder:text-muted-foreground/60"
                    />
                    <button
                      onClick={handleAddCompetitor}
                      className="bg-primary hover:bg-primary/90 text-white border-none py-2 px-4 rounded-lg cursor-pointer text-xs font-bold active:scale-95 transition-all"
                    >
                      Aggiungi
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Right */}
          <div className="flex flex-col gap-6">
            {client.intelligence && (
              <>
                {/* Meta Targeting */}
                <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] flex flex-col gap-4 shadow-md">
                  <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                    Input per Algoritmo Meta
                  </h3>

                  <div>
                    <div className="text-xs text-muted-foreground/80 font-bold uppercase tracking-wider mb-2">
                      Interessi Seed (Broad)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {client.intelligence.metaInterests.map(
                        (interest: string, i: number) => (
                          <span
                            key={i}
                            className="text-xs bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-indigo-400 font-bold"
                          >
                            {interest}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground/80 font-bold uppercase tracking-wider mb-2">
                      Dati Demografici Estesi
                    </div>
                    <div className="text-xs text-muted-foreground/90 leading-relaxed space-y-1.5 bg-white/5 p-3.5 rounded-xl border border-white/5">
                      <div>
                        Età:{" "}
                        <strong className="text-foreground">
                          {client.intelligence.targetAgeMin} -{" "}
                          {client.intelligence.targetAgeMax}
                        </strong>
                      </div>
                      <div>
                        Genere:{" "}
                        <strong className="text-foreground">
                          {client.intelligence.targetGender}
                        </strong>
                      </div>
                      <div>
                        Territorio:{" "}
                        <strong className="text-foreground">
                          {client.intelligence.territoryType}
                        </strong>
                        {client.intelligence.territoryCities &&
                        client.intelligence.territoryCities.length > 0
                          ? ` (${client.intelligence.territoryCities.join(", ")})`
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ultra Senior Notes */}
                {client.intelligence.analysisNotes && (
                  <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/[0.03] shadow-sm">
                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-2">
                      Ultra Senior Insight
                    </h3>
                    <p className="text-xs text-muted-foreground/90 leading-relaxed">
                      {client.intelligence.analysisNotes}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: CAMPAGNE */}
      {activeTab === "campaigns" && (() => {
        const filtered = allCampaigns.filter((c) => {
          if (campaignStatusFilter !== 'all' && c.status !== campaignStatusFilter) return false;
          if (campaignFilter && !c.name.toLowerCase().includes(campaignFilter.toLowerCase())) return false;
          // Overlap check: keep a campaign if any part of its known date range
          // (startDate..endDate, whichever are known) falls within the filter
          // window. A campaign with no dates at all is never hidden by a date
          // filter — better to over-show than to silently drop it.
          if (campaignDateFrom && c.endDate && c.endDate < campaignDateFrom) return false;
          if (campaignDateTo && c.startDate && c.startDate > campaignDateTo) return false;
          return true;
        });

        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-foreground">Campagne</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Campagne reali su Meta Ads e Google Ads — ultimi 90 giorni
                </p>
              </div>
              <Link
                href={`/clients/${id}/meta-ads/new`}
                className="btn-gorgeous inline-flex items-center gap-2 no-underline text-xs font-bold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shrink-0"
              >
                <Plus size={16} /> Nuova Campagna
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  placeholder="Filtra per nome..."
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={campaignStatusFilter}
                onValueChange={(v) => setCampaignStatusFilter(v as typeof campaignStatusFilter)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="active">Attive</SelectItem>
                  <SelectItem value="paused">In pausa</SelectItem>
                  <SelectItem value="ended">Finite</SelectItem>
                </SelectContent>
              </Select>

              <MetricoolDatePicker date={campaignRange} setDate={setCampaignRange} />

              {campaignRange && (
                <Button variant="ghost" size="sm" onClick={() => setCampaignRange(undefined)}>
                  Azzera periodo
                </Button>
              )}

              {loadingCampaigns && (
                <span className="text-xs text-muted-foreground/60 animate-pulse">Caricamento...</span>
              )}
            </div>

            {!loadingCampaigns && filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                <Zap size={40} className="opacity-20 text-muted-foreground" />
                <h3 className="font-bold text-foreground">
                  {allCampaigns.length === 0 ? "Nessuna campagna trovata" : "Nessuna campagna corrisponde ai filtri"}
                </h3>
                <p className="text-xs text-muted-foreground/60">
                  {allCampaigns.length === 0
                    ? "Collega Meta Ads e/o Google Ads in Setup API per vederle qui."
                    : "Prova ad allargare l'intervallo di date o cambiare stato."}
                </p>
              </div>
            ) : (
              <CampaignsTable
                rows={filtered}
                loadingReportId={loadingReportId}
                onOpenReport={(c) => handleOpenReport(c.id, c.objective || 'Sconosciuto', c.name)}
              />
            )}
          </div>
        );
      })()}

      {/* RENDER MODAL REPORT */}
      {reportModalData && (
        <MetaCampaignReportModal
          onClose={() => {
            setReportModalData(null);
            setReportModalDatePreset("last_30d");
          }}
          campaignTitle={reportModalData.campaignName}
          objective={reportModalData.objective || "Sconosciuto"}
          baseMetrics={reportModalData.base}
          specificMetrics={reportModalData.specific}
          datePreset={reportModalDatePreset}
          isLoading={isReportRefreshing}
          onDateChange={(preset) =>
            handleOpenReport(
              reportModalData.campaignId,
              reportModalData.objective || "Sconosciuto",
              reportModalData.campaignName,
              preset,
            )
          }
        />
      )}

      <SeoAuditModal
        isOpen={seoReportOpen}
        onClose={() => setSeoReportOpen(false)}
        clientId={client.id}
        clientName={client.name}
        onSaved={(score) => setClient((prev) => (prev ? { ...prev, lastSeoScore: score } : prev))}
      />

      {/* TAB: HEATMAPS */}
      {activeTab === "heatmaps" && (
        <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] min-h-[80vh] flex flex-col gap-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MousePointerClick size={24} className="text-violet-400" />
              <h3 className="text-lg font-extrabold text-foreground">
                Mappe di Calore & Sessioni (Clarity)
              </h3>
            </div>
            {client.clarityProjectId && (
              <a
                href={`https://clarity.microsoft.com/projects/view/${client.clarityProjectId}/dashboard?date=Last%2030%20days`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-400 hover:text-violet-300 font-bold px-4 py-2 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 rounded-lg no-underline transition-all inline-flex items-center justify-center active:scale-95"
              >
                Apri a tutto schermo ↗
              </a>
            )}
          </div>

          {!client.clarityProjectId ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-violet-500/20 rounded-2xl bg-violet-500/5 p-8 text-center min-h-[400px]">
              <Eye size={40} className="text-violet-400 mb-4 opacity-50" />
              <h4 className="text-base font-bold text-foreground mb-2">
                Clarity Non Connesso
              </h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                Inserisci il Project ID di Microsoft Clarity nelle impostazioni
                API per sbloccare le mappe di calore live e le registrazioni
                degli utenti sul sito{" "}
                {client.websiteUrl?.replace("https://", "") || "selezionato"}.
              </p>
              <button
                onClick={() => setActiveTab("settings")}
                className="btn-gorgeous px-6 py-2.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white cursor-pointer transition-all"
              >
                Vai a Setup API
              </button>
            </div>
          ) : (
            /* Clarity non si può incorporare: risponde con
               `x-frame-options: SAMEORIGIN`, quindi qualunque iframe verso il
               loro dominio viene bloccato dal browser ("Questi contenuti sono
               bloccati"). Qui c'era un iframe verso un presunto /embed/ che
               non ha mai mostrato nulla.

               E anche potendo, non basterebbe: heatmap e registrazioni di
               sessione — cioè il motivo per cui si usa Clarity — non escono
               dalla loro API, si vedono solo dentro Clarity. Meglio un
               collegamento che funziona di un riquadro che finge. */
            <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-10 flex flex-col items-center justify-center text-center gap-4 min-h-[320px]">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                <MousePointerClick size={22} className="text-violet-400" />
              </div>
              <div className="space-y-1.5 max-w-lg">
                <h3 className="text-base font-bold text-foreground">Heatmap e registrazioni su Clarity</h3>
                <p className="text-sm text-muted-foreground">
                  Microsoft non consente di mostrare Clarity dentro un altro sito, e le mappe di calore
                  e le registrazioni di sessione non sono esportabili via API: si consultano sul loro pannello.
                </p>
                <p className="text-xs text-muted-foreground/70 pt-1">
                  Progetto <span className="font-mono">{client.clarityProjectId}</span>
                </p>
              </div>
              <a
                href={`https://clarity.microsoft.com/projects/view/${client.clarityProjectId}/dashboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gorgeous px-6 py-2.5 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white cursor-pointer transition-all inline-flex items-center gap-2"
              >
                Apri Clarity <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* TAB: API SETTINGS */}
      {activeTab === "settings" && (
        <div className="w-full">
          <PlatformConnections
            clientId={id as string}
            initialClient={{
              id: client.id,
              hasMetaToken: client.hasMetaToken,
              metaAdAccountId: client.metaAdAccountId,
              metaPageId: client.metaPageId,
              ga4PropertyId: client.ga4PropertyId,
              googleAdAccountId: client.googleAdAccountId,
              gbpLocations: client.gbpLocations,
              gbpLocationId: client.gbpLocationId,
              gbpAccountId: client.gbpAccountId,
              gbpActiveLocationId: client.gbpActiveLocationId,
              clarityProjectId: client.clarityProjectId,
              hasGoogleToken: !!(client.googleAdAccountId || client.ga4PropertyId),
              // Social organico
              hasYoutubeToken:    client.hasYoutubeToken    ?? false,
              youtubeChannelName: client.youtubeChannelName ?? null,
              youtubePublicChannelId:   client.youtubePublicChannelId   ?? null,
              youtubePublicChannelName: client.youtubePublicChannelName ?? null,
              hasTiktokToken:     client.hasTiktokToken     ?? false,
              tiktokDisplayName:  client.tiktokDisplayName  ?? null,
              hasLinkedinToken:   client.hasLinkedinToken   ?? false,
              linkedinOrgName:    client.linkedinOrgName    ?? null,
              windsorAccounts:    client.windsorAccounts    ?? undefined,
            }}
            onClientUpdated={() => window.location.reload()}
          />
        </div>
      )}
    </div>
  );
}

