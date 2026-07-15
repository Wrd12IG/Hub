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
} from "lucide-react";
import MetaCampaignReportModal from "@/components/MetaCampaignReportModal";
import dynamic from "next/dynamic";
const SeoGodModeReportModal = dynamic(
  () => import("@/components/SeoGodModeReportModal"),
  { ssr: false },
);
import GbpDashboardTab from "@/components/GbpDashboardTab";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Nessun dato placeholder — tutti i dati sono reali da Firebase / API collegate

interface Client {
  id: string;
  name: string;
  websiteUrl: string;
  creativeMode: string;
  targetCPA: number | null;
  targetROAS: number | null;
  industry: string | null;
  metaAdAccountId: string;
  metaPageId: string;
  metaPixelId: string | null;
  hasMetaToken: boolean;
  lastAuditScore: number | null;
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
  hasTiktokToken?: boolean;
  tiktokDisplayName?: string | null;
  hasLinkedinToken?: boolean;
  linkedinOrgName?: string | null;
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

function AuditMeter({ score }: { score: number }) {
  const color =
    score >= 70
      ? "text-emerald-400"
      : score >= 40
        ? "text-amber-400"
        : "text-rose-400";
  const strokeColor =
    score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f87171";
  const label =
    score >= 70 ? "Ottimo" : score >= 40 ? "Migliorabile" : "Critico";
  const glowShadow =
    score >= 70
      ? "shadow-[0_0_20px_rgba(52,211,153,0.15)]"
      : score >= 40
        ? "shadow-[0_0_20px_rgba(251,191,36,0.15)]"
        : "shadow-[0_0_20px_rgba(248,113,113,0.15)]";

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "relative w-28 h-28 flex items-center justify-center rounded-full bg-white/[0.01] border border-white/5 transition-all duration-300",
          glowShadow,
        )}
      >
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-black tracking-tight", color)}>
            {score}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            Score
          </span>
        </div>
      </div>
      <div
        className={cn("text-xs font-bold mt-3 tracking-wide uppercase", color)}
      >
        {label}
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams() as { id: string };
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "intelligence"
    | "campaigns"
    | "assets"
    | "settings"
    | "heatmaps"
    | "gbp"
  >("overview");
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [uploadingVisionIndex, setUploadingVisionIndex] = useState<
    number | null
  >(null);

  const [metaCampaigns, setMetaCampaigns] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
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
  const [overviewDaysBack, setOverviewDaysBack] = useState(30);
  const [compareMode, setCompareMode] = useState("prev_period");
  const [performanceData, setPerformanceData] = useState<any | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);
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
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);

  useEffect(() => {
    if (!id) return;
    const checkAuditStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/clients/${id}/audit/status`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "running") {
          setLoadingAudit(true);
          setAuditProgress(data.progress);
        }
      } catch (e) {
        console.error("[audit] Error checking audit status:", e);
      }
    };
    checkAuditStatus();
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let isMounted = true;
    if (loadingAudit) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/clients/${id}/audit/status`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          if (!res.ok || !isMounted) return;
          const data = await res.json();
          if (!isMounted) return;
          if (data.status === "running") {
            setAuditProgress(data.progress);
          } else if (data.status === "error") {
            clearInterval(interval);
            setLoadingAudit(false);
            console.error("[audit] Background operation failed:", data.error);
            toast.error("Operazione in background fallita: " + data.error);
          } else if (data.status === "completed") {
            clearInterval(interval);
            window.location.reload();
          }
        } catch (e) {
          console.error("[audit] Error polling audit status:", e);
        }
      }, 2000);
    }
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loadingAudit, id]);

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

  useEffect(() => {
    if (id && activeTab === "overview") {
      setLoadingPerformance(true);
      fetch(
        `${API_URL}/api/clients/${id}/performance?daysBack=${overviewDaysBack}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.ok) setPerformanceData(data);
          else setPerformanceData(null);
        })
        .catch(() => setPerformanceData(null))
        .finally(() => setLoadingPerformance(false));
    }
  }, [id, activeTab, overviewDaysBack]);

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewCompetitorName("");
      window.location.reload();
    } catch (e) {
      console.error("[competitor] Error adding competitor:", e);
      toast.error("Impossibile aggiungere il competitor. Riprova.");
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (e) {
      console.error("[competitor] Error deleting competitor:", e);
      toast.error("Impossibile eliminare il competitor. Riprova.");
    }
  };

  const handleScreenshotUpload = async (index: number, file: File) => {
    if (!client || !file) return;
    setUploadingVisionIndex(index);

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(
          `${API_URL}/api/clients/${client.id}/intelligence/competitors/${index}/vision`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ base64Image }),
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.location.reload();
      } catch (e) {
        console.error("[vision] Error uploading screenshot:", e);
        toast.error("Impossibile caricare lo screenshot. Riprova.");
      } finally {
        setUploadingVisionIndex(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerAudit = async () => {
    if (!client) return;
    setLoadingAudit(true);
    setAuditProgress(0);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/clients/${client.id}/audit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Errore durante la generazione dell'audit.");
        setLoadingAudit(false);
      }
    } catch (e) {
      toast.error("Errore di connessione.");
      setLoadingAudit(false);
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

        // Fetch Meta campaigns in parallel
        setLoadingMeta(true);
        try {
          const metaRes = await fetch(
            `${API_URL}/api/clients/${id}/meta/campaigns`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (metaRes.ok) {
            const metaData = await metaRes.json();
            setMetaCampaigns(metaData.campaigns || []);
          }
        } catch (e) {
          console.error("Failed to load meta campaigns", e);
        } finally {
          setLoadingMeta(false);
        }

        // Fetch GA4 Data logic is now moved to its own isolated useEffect (see below) to react to overviewDaysBack Filter

        // Fetch SEO Reports
        try {
          const seoRes = await fetch(
            `${API_URL}/api/clients/${id}/seo-reports`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (seoRes.ok) {
            const seoData = await seoRes.json();
            setSeoReportsList(seoData || []);
          }
        } catch (e) {
          console.error("Failed to load seo reports", e);
        }
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
          `${API_URL}/api/clients/${id}/analytics?dateRange=${overviewDaysBack}d&compare=${compareMode}`,
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
  }, [client?.ga4PropertyId, overviewDaysBack, compareMode, id]);

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
        <div className="text-5xl opacity-30">🔍</div>
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

  const tabs = [
    { id: "overview", label: "Overview & Audit", icon: LayoutDashboard },
    { id: "intelligence", label: "AI Intelligence", icon: Brain },
    {
      id: "campaigns",
      label: `Campagne (${client.campaigns?.length || 0})`,
      icon: Target,
    },
    {
      id: "assets",
      label: `Brand Assets (${client.brandAssets?.length || 0})`,
      icon: ImageIcon,
    },
    { id: "heatmaps", label: "Heatmaps & Registrazioni", icon: Eye },
    { id: "gbp", label: "Profilo GBP", icon: MapPin },
    { id: "settings", label: "Setup API", icon: Settings },
  ];

  const growthHref = `/clients/${id}/growth`;

  // Calcolo reale traffico social da GA4
  const socialChannels =
    ga4Data?.traffic?.channels?.filter(
      (c: any) =>
        c.channel.toLowerCase().includes("social") ||
        c.channel.toLowerCase().includes("video"),
    ) || [];
  const totalSocialSessions = socialChannels.reduce(
    (sum: number, c: any) => sum + (c.sessions || 0),
    0,
  );
  const socialConvs =
    ga4Data?.conversions?.byChannel?.filter((c: any) =>
      c.channel.toLowerCase().includes("social"),
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
            <h1 className="text-3xl font-black tracking-tight text-foreground font-headline">
              {client.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
              {client.websiteUrl && (
                <a
                  href={client.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                >
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  {client.websiteUrl.replace(/^https?:\/\//, "")}
                </a>
              )}
              {client.industry && (
                <Badge
                  variant="secondary"
                  className="font-bold rounded-lg border border-white/5 bg-white/5 px-2 py-0.5 text-[10px]"
                >
                  {client.industry}
                </Badge>
              )}
              {client.creativeMode && (
                <Badge
                  variant="outline"
                  className="font-bold rounded-lg border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  Modalità: {client.creativeMode}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: switcher + action */}
        <div className="flex flex-col gap-3 items-start sm:items-end shrink-0">
          {allClients.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Passa a:
              </span>
              <Select
                value={client.id}
                onValueChange={(v) => {
                  window.location.href = `/clients/${v}`;
                }}
              >
                <SelectTrigger className="h-8.5 text-xs font-bold w-[180px] bg-background/50 border-white/10 rounded-xl">
                  <SelectValue />
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

      {/* ── QUICK LINKS (analytics dashboards) ── */}
      <div className="relative z-20 flex flex-wrap gap-2.5 bg-white/[0.01] border border-white/5 p-4 rounded-2xl shadow-sm">
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
          {
            href: `/clients/${id}/calendar`,
            icon: Calendar,
            label: "Calendario",
            dot: "bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]",
          },
          {
            href: `/reports`,
            icon: TrendingUp,
            label: "Growth Report",
            dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
          },
          {
            href: `/clients/${id}/creative`,
            icon: Sparkles,
            label: "Creative Lab",
            dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
          },
          {
            href: `/assets`,
            icon: ImageIcon,
            label: "Creative Board",
            dot: "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]",
          },
          {
            href: `/clients/${id}/gbp`,
            icon: MapPin,
            label: "Maps & GBP",
            dot: "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]",
          },
        ].map(({ href, icon: Icon, label, dot }) => (
          <Link
            key={href}
            href={href}
            className="relative z-10 cursor-pointer glass-card inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-white/5 bg-white/[0.02] hover:bg-white/[0.07] hover:border-white/10 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95 text-foreground"
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
            <Icon className="h-3.5 w-3.5 text-muted-foreground/80" />
            {label}
          </Link>
        ))}
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
                <Icon className="h-4 w-4" />
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
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">
                  Periodo:
                </span>
              </div>
              <select
                value={overviewDaysBack}
                onChange={(e) => setOverviewDaysBack(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-background/50 hover:border-white/20 text-sm font-medium outline-none cursor-pointer transition-colors text-foreground"
              >
                <option value={7}>Ultimi 7 Giorni</option>
                <option value={30}>Ultimi 30 Giorni</option>
                <option value={60}>Ultimi 60 Giorni</option>
                <option value={90}>Ultimi 90 Giorni</option>
                <option value={180}>Ultimi 6 Mesi</option>
              </select>
            </div>

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

          {/* BENTO GRID: Overview Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* CARD 1: Domain Performance (GA4) - Spans 2 cols on lg */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] lg:col-span-2 space-y-6 shadow-md">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold font-headline">
                  Performance Dominio:{" "}
                  {client.websiteUrl?.replace("https://", "") ||
                    "Nessun dominio"}
                </h3>
              </div>

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
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
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
                          <div className="text-[11px] font-bold text-muted-foreground/75 uppercase tracking-wider truncate">
                            {item.label}
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-xl font-extrabold tracking-tight text-foreground">
                              {item.metric ? item.format(item.metric.val) : "0"}
                            </span>
                            {item.metric && (
                              <span
                                className={cn(
                                  "text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm",
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
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
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
                          <div className="text-[11px] font-bold text-muted-foreground/75 uppercase tracking-wider truncate">
                            {item.label}
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-xl font-extrabold tracking-tight text-foreground">
                              {item.metric ? item.format(item.metric.val) : "0"}
                            </span>
                            {item.metric && (
                              <span
                                className={cn(
                                  "text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm",
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
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Conversioni (Ultimi {overviewDaysBack}gg vs prec.)
                    </h4>
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
                        },
                        {
                          label: "Revenue Generato",
                          metric: ga4Data.conversions?.revenue,
                          format: (v: number) => `€${v.toLocaleString()}`,
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="glass-card hover:bg-white/[0.06] hover:border-white/15 p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col justify-between min-h-[95px] shadow-sm transition-all duration-300 hover:-translate-y-0.5"
                        >
                          <div className="text-[11px] font-bold text-muted-foreground/75 uppercase tracking-wider truncate">
                            {item.label}
                          </div>
                          <div className="flex items-baseline justify-between mt-2">
                            <span className="text-xl font-extrabold tracking-tight text-foreground">
                              {item.metric ? item.format(item.metric.val) : "0"}
                            </span>
                            {item.metric && (
                              <span
                                className={cn(
                                  "text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm",
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
            </div>

            {/* CARD 2: Health Score & Audit AI - Spans 1 col */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] shadow-md flex items-center justify-between gap-6">
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                  Health Score Ads
                </h3>
                <div className="text-[10px] text-muted-foreground/60 font-medium">
                  {client.lastAuditAt
                    ? `Aggiornato il ${new Date(client.lastAuditAt).toLocaleDateString()}`
                    : "Mai analizzato"}
                </div>
                {client.lastAuditPdfUrl && (
                  <a
                    href={client.lastAuditPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2.5 text-xs text-primary font-bold hover:underline transition-all"
                  >
                    <Download className="h-3.5 w-3.5" /> Report PDF
                  </a>
                )}
              </div>
              {client.lastAuditScore !== null ? (
                <div className="scale-95 origin-right">
                  <AuditMeter score={client.lastAuditScore} />
                </div>
              ) : (
                <div className="flex items-center min-w-[150px] flex-1">
                  {loadingAudit ? (
                    <div className="w-full flex flex-col gap-1.5">
                      <div className="flex justify-between text-[10px] font-bold text-primary">
                        <span>Analisi AI in corso...</span>
                        <span>{auditProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${auditProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={handleTriggerAudit}
                      size="sm"
                      className="w-full active:scale-[0.97] transition-all rounded-xl font-bold bg-primary text-primary-foreground shadow-md"
                    >
                      🔄 Richiedi Audit AI
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* CARD 3: SEO Godmode Generator - Spans 2 cols on lg */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-950/20 via-purple-950/20 to-pink-950/20 lg:col-span-2 space-y-4 shadow-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground tracking-tight">
                      Intelligenza Artificiale: Audit Godmode SEO
                    </h3>
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                      Scansione tecnica automatizzata simulando i crawler Google
                      e l'algoritmo semantico di ranking.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2">
                  <Button
                    onClick={() => setSeoReportOpen(true)}
                    className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white border-0 py-4.5 px-6 rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" /> Genera Report SEO (GODMODE)
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
                            "text-[10px] transition-transform duration-200 text-muted-foreground",
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
                              className="flex justify-between items-center p-2 bg-white/[0.02] hover:bg-white/[0.05] rounded-lg text-[11px] transition-colors border border-white/5"
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
              </div>
            </div>

            {/* CARD 4: Anomalie Cliente (Alerts) - Spans 1 col */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] shadow-md flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" />
                  <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                    Anomalie Cliente (Alerts)
                  </h3>
                </div>
                {!client.hasMetaToken ? (
                  <div className="bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-xl text-xs flex justify-between items-center gap-3">
                    <div>
                      <div className="font-bold text-rose-400">
                        Token Meta Mancante / Scaduto
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Le campagne non possono sincronizzarsi.
                      </div>
                    </div>
                    <Button
                      onClick={() => setActiveTab("settings")}
                      size="sm"
                      variant="outline"
                      className="h-7 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 text-[10px] font-bold rounded-lg px-2.5"
                    >
                      Configura
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground/80 font-medium">
                    Nessuna anomalia grave rilevata. Operatività fluida.
                  </div>
                )}

                {/* Alert reali — visibili solo quando GA4 o Meta sono collegati */}
                {client.hasMetaToken && client.ga4PropertyId ? null : (
                  <div className="bg-primary/5 border border-primary/10 p-3.5 rounded-xl text-xs">
                    <div className="font-bold text-primary">
                      Collega i servizi per gli alert automatici
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Connetti Meta Ads e Google Analytics in "Setup API" per
                      ricevere anomalie in tempo reale.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* OMNICHANNEL ADVERTISING (META + GOOGLE ADS)          */}
          {/* ==================================================== */}
          <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg relative overflow-hidden">
            {loadingPerformance && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                <div className="px-5 py-2.5 bg-background border border-border rounded-full shadow-lg text-primary font-bold flex items-center gap-2 text-sm animate-bounce">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aggiornamento metriche in corso...
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6">
              <h3 className="text-xl font-bold font-headline flex items-center gap-2 text-foreground">
                <Target className="h-6 w-6 text-primary" />
                Performance Advertising (Full Funnel)
              </h3>
              <div className="text-xs text-muted-foreground font-semibold">
                Budget Omnicanale:{" "}
                <strong className="text-foreground text-sm font-black">
                  {performanceData?.meta?.spend != null ||
                  performanceData?.google?.spend != null
                    ? new Intl.NumberFormat("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      }).format(
                        (performanceData?.meta?.spend || 0) +
                          (performanceData?.google?.spend || 0),
                      )
                    : "N/D"}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* META ADS */}
              <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4 border-l-2 border-l-blue-500/60">
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <Facebook className="h-4.5 w-4.5 text-blue-400" /> Meta Ads
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/40 p-3 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Spesa
                    </div>
                    <div className="text-lg font-black mt-0.5 text-foreground">
                      {performanceData?.meta?.spend != null
                        ? new Intl.NumberFormat("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          }).format(performanceData.meta.spend)
                        : "N/D"}
                    </div>
                  </div>
                  <div className="bg-background/40 p-3 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      CPA (Acq.)
                    </div>
                    <div className="text-lg font-black mt-0.5 text-foreground">
                      {performanceData?.meta?.cpa != null
                        ? new Intl.NumberFormat("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          }).format(performanceData.meta.cpa)
                        : "N/D"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground/80 space-y-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between">
                    <span>Impression:</span>{" "}
                    <strong className="text-foreground font-bold">
                      {performanceData?.meta?.impressions != null
                        ? new Intl.NumberFormat("it-IT", {
                            notation: "compact",
                          }).format(performanceData.meta.impressions)
                        : "N/D"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Link Clicks:</span>{" "}
                    <strong className="text-foreground font-bold">
                      {performanceData?.meta?.clicks != null
                        ? new Intl.NumberFormat("it-IT").format(
                            performanceData.meta.clicks,
                          )
                        : "N/D"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>CTR:</span>{" "}
                    <strong className="text-foreground font-bold">
                      {performanceData?.meta?.ctr != null
                        ? performanceData.meta.ctr.toFixed(2) + "%"
                        : "N/D"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* GOOGLE ADS */}
              <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4 border-l-2 border-l-rose-500/60">
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <Search className="h-4.5 w-4.5 text-rose-400" /> Google Ads
                  (Search)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/40 p-3 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Spesa
                    </div>
                    <div className="text-lg font-black mt-0.5 text-foreground">
                      {performanceData?.google?.spend != null
                        ? new Intl.NumberFormat("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          }).format(performanceData.google.spend)
                        : "N/D"}
                    </div>
                  </div>
                  <div className="bg-background/40 p-3 rounded-xl border border-white/5 shadow-sm">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      CPC Medio
                    </div>
                    <div className="text-lg font-black mt-0.5 text-emerald-400">
                      {performanceData?.google?.cpc != null
                        ? new Intl.NumberFormat("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          }).format(performanceData.google.cpc)
                        : "N/D"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground/80 space-y-2 border-t border-white/5 pt-3">
                  <div className="flex justify-between">
                    <span>Impression:</span>{" "}
                    <strong className="text-foreground font-bold">
                      {performanceData?.google?.impressions != null
                        ? new Intl.NumberFormat("it-IT", {
                            notation: "compact",
                          }).format(performanceData.google.impressions)
                        : "N/D"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>CTR (Search):</span>{" "}
                    <strong className="text-foreground font-bold">
                      {performanceData?.google?.ctr != null
                        ? performanceData.google.ctr.toFixed(2) + "%"
                        : "N/D"}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Conversioni:</span>{" "}
                    <strong className="text-foreground font-bold">
                      {performanceData?.google?.conversions != null
                        ? new Intl.NumberFormat("it-IT").format(
                            performanceData.google.conversions,
                          )
                        : "N/D"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* DISPLAY & AI BUDGET RIPARTITION */}
              <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col justify-between border-l-2 border-l-amber-500/60">
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <MonitorPlay className="h-4.5 w-4.5 text-amber-400" />{" "}
                  Insights & Allocazione
                </h4>
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <PieChart className="h-8 w-8 mb-2 opacity-30 text-amber-400" />
                  <div className="font-bold text-xs text-foreground mb-1">
                    Display non configurato
                  </div>
                  <div className="text-[11px] leading-relaxed max-w-[180px]">
                    Collega le campagne Display/DV360 per vedere frequenza e
                    viewability reali
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* SEO & REPUTATION (GSC + REVIEWS)                     */}
          {/* ==================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-6">
            {/* SEO (Search Console + Backlinks) */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] lg:col-span-3 shadow-md">
              <h3 className="text-base font-extrabold flex items-center gap-3 mb-6 text-foreground">
                <Search size={20} className="text-blue-400" /> SEO & Keyword
                View (GSC)
              </h3>

              <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-muted-foreground bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                <Search
                  size={32}
                  className="opacity-20 mb-3 text-muted-foreground"
                />
                <div className="font-bold text-sm mb-1 text-foreground">
                  Google Search Console non collegato
                </div>
                <div className="text-xs max-w-[320px] leading-relaxed">
                  Collega GSC in Setup API per vedere ranking reali, keyword
                  opportunities e backlink del cliente
                </div>
                <button
                  onClick={() => setActiveTab("settings")}
                  className="mt-4 text-xs text-primary bg-transparent border border-primary/30 hover:bg-primary/10 active:scale-95 transition-all rounded-lg px-4 py-1.5 font-bold"
                >
                  Collega in Setup API →
                </button>
              </div>
            </div>

            {/* QUALITATIVE FEEDBACK (Reviews) */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.03] lg:col-span-2 flex flex-col shadow-md">
              <h3 className="text-base font-extrabold flex items-center gap-3 mb-6 text-foreground">
                <Star size={20} className="text-amber-400 fill-amber-400/30" />{" "}
                Reputation & UX
              </h3>

              <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                <Star
                  size={32}
                  className="opacity-20 mb-3 text-muted-foreground"
                />
                <div className="font-bold text-sm mb-1 text-foreground">
                  Nessuna recensione collegata
                </div>
                <div className="text-xs max-w-[220px] leading-relaxed">
                  Collega Google Business Profile o Trustpilot per vedere
                  recensioni e sentiment reali
                </div>
                <button
                  onClick={() => setActiveTab("settings")}
                  className="mt-4 text-xs text-primary bg-transparent border border-primary/30 hover:bg-primary/10 active:scale-95 transition-all rounded-lg px-4 py-1.5 font-bold"
                >
                  Collega in Setup API →
                </button>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* ATTRAZIONE & COMPETITOR INTELLIGENCE FULL WIDTH      */}
          {/* ==================================================== */}
          <section className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10 bg-white/[0.03] mt-6 shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <Share2 size={24} className="text-pink-400" />
              <h2 className="text-xl font-bold text-foreground">
                Intelligenza di Attrazione (Content & Competitori)
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
              {/* LATO SINISTRO: Metriche Organiche e Database Contenuti */}
              <div className="flex flex-col gap-6 lg:col-span-4">
                {/* Metriche Canali Deep Dive */}
                <div>
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">
                    Ecosistema Digitale (Deep Dive 30giorni)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1. SITO WEB */}
                    <div className="glass-card border border-white/8 bg-white/[0.02] p-5 rounded-xl flex flex-col border-l-2 border-l-blue-500/50">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <Globe size={20} className="text-blue-400" />
                          <span className="font-extrabold text-sm text-foreground">
                            Sito Web (GA4)
                          </span>
                        </div>
                        {loadingGa4 ? (
                          <span className="text-[10px] text-muted-foreground">
                            Caricamento...
                          </span>
                        ) : ga4Data?.traffic?.users?.chg != null ? (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${ga4Data.traffic.users.chg >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}
                          >
                            {ga4Data.traffic.users.chg > 0 ? "+" : ""}
                            {ga4Data.traffic.users.chg}%
                          </span>
                        ) : null}
                      </div>
                      {!loadingGa4 && !ga4Data ? (
                        <div className="text-center py-4 text-muted-foreground text-xs flex-1 flex flex-col items-center justify-center">
                          <div className="text-2xl mb-2">📊</div>
                          <div className="font-bold mb-1 text-foreground">
                            GA4 non collegato
                          </div>
                          <button
                            onClick={() => setActiveTab("settings")}
                            className="text-xs text-blue-400 hover:underline bg-transparent border-none cursor-pointer font-semibold"
                          >
                            Collega in Setup API →
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <div className="text-2xl font-black leading-none text-foreground">
                              {loadingGa4
                                ? "..."
                                : ga4Data?.traffic?.users?.val != null
                                  ? ga4Data.traffic.users.val.toLocaleString()
                                  : "—"}
                            </div>
                            <div className="text-[11px] text-muted-foreground/75 mt-1 font-semibold">
                              Utenti Unici nel Periodo
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                              <div className="text-muted-foreground/70 mb-0.5 text-[10px] font-bold">
                                Sessions Social
                              </div>
                              <div className="font-extrabold text-foreground">
                                {loadingGa4
                                  ? "..."
                                  : ga4Data
                                    ? totalSocialSessions.toLocaleString()
                                    : "—"}
                              </div>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                              <div className="text-muted-foreground/70 mb-0.5 text-[10px] font-bold">
                                CVR da Social
                              </div>
                              <div className="font-extrabold text-foreground">
                                {loadingGa4
                                  ? "..."
                                  : ga4Data
                                    ? `${socialCvr}%`
                                    : "—"}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                              <div className="text-muted-foreground/70 mb-0.5 text-[10px] font-bold">
                                Bounce Rate
                              </div>
                              <div className="font-extrabold text-foreground">
                                {loadingGa4
                                  ? "..."
                                  : ga4Data?.behavior?.bounceRate?.val != null
                                    ? `${ga4Data.behavior.bounceRate.val.toFixed(1)}%`
                                    : "—"}
                              </div>
                            </div>
                            <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                              <div className="text-muted-foreground/70 mb-0.5 text-[10px] font-bold">
                                Channel Top
                              </div>
                              <div className="font-extrabold text-foreground truncate">
                                {loadingGa4
                                  ? "..."
                                  : ga4Data?.traffic?.channels?.[0]?.channel ||
                                    "—"}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      <div className="mt-4 pt-3 border-t border-white/5">
                        <div className="text-muted-foreground/60 text-[10px] italic">
                          {ga4Data
                            ? "Dati demografici disponibili nel report GA4 completo"
                            : "Collega GA4 per vedere le demografiche reali del sito"}
                        </div>
                      </div>
                    </div>

                    {/* 2. INSTAGRAM */}
                    <div className="glass-card border border-white/8 bg-white/[0.02] p-5 rounded-xl flex flex-col border-l-2 border-l-pink-500/50">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <Instagram size={20} className="text-pink-400" />
                          <span className="font-extrabold text-sm text-foreground">
                            Instagram
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                        <div className="text-2xl mb-2">📱</div>
                        <div className="font-bold text-xs mb-1 text-foreground">
                          Instagram non collegato
                        </div>
                        <div className="text-[10px] max-w-[200px] leading-relaxed text-muted-foreground/80">
                          Collega il Page ID Meta in Setup API per vedere
                          follower, reach ed engagement reali
                        </div>
                        <button
                          onClick={() => setActiveTab("settings")}
                          className="mt-3 text-[10px] text-pink-400 bg-transparent border border-pink-500/30 hover:bg-pink-500/10 active:scale-95 transition-all rounded-lg px-3 py-1 font-bold"
                        >
                          Collega in Setup API →
                        </button>
                      </div>
                    </div>

                    {/* 3. YOUTUBE */}
                    <div className="glass-card border border-white/8 bg-white/[0.02] p-5 rounded-xl flex flex-col border-l-2 border-l-rose-500/50">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <Youtube size={20} className="text-rose-400" />
                          <span className="font-extrabold text-sm text-foreground">
                            YouTube
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                        <div className="text-2xl mb-2">▶️</div>
                        <div className="font-bold text-xs mb-1 text-foreground">
                          YouTube non collegato
                        </div>
                        <div className="text-[10px] max-w-[200px] leading-relaxed text-muted-foreground/80">
                          Integrazione YouTube Analytics in arrivo — iscritti,
                          views e watch time reali
                        </div>
                      </div>
                    </div>

                    {/* 4. TIKTOK */}
                    <div className="glass-card border border-white/10 bg-white/[0.01] p-5 rounded-xl flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <Music size={20} className="text-foreground" />
                        <span className="font-extrabold text-sm text-foreground">
                          TikTok
                        </span>
                      </div>
                      <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                        <div className="text-2xl mb-2">🎵</div>
                        <div className="font-bold text-xs mb-1 text-foreground">
                          TikTok non collegato
                        </div>
                        <div className="text-[10px] max-w-[200px] leading-relaxed text-muted-foreground/80">
                          Integrazione TikTok Business API in arrivo —
                          followers, views e completion rate reali
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contenuti Top Performance — visibili quando i canali social sono collegati */}
                <div className="flex flex-col items-center justify-center py-8 px-4 gap-3 bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                  <PlayCircle
                    size={32}
                    className="opacity-20 text-foreground"
                  />
                  <div className="font-bold text-sm text-foreground">
                    Nessun contenuto tracciato
                  </div>
                  <div className="text-xs text-muted-foreground text-center max-w-[320px]">
                    Collega i canali social del cliente per visualizzare
                    automaticamente i contenuti con le migliori performance.
                  </div>
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="mt-2 text-xs bg-primary hover:bg-primary/90 text-white border-none py-1.5 px-4 rounded-lg cursor-pointer font-bold active:scale-95 transition-all"
                  >
                    ⚙️ Setup API
                  </button>
                </div>
              </div>

              {/* LATO DESTRO: Competitor e Trends */}
              <div className="flex flex-col gap-6 lg:col-span-3 border-t lg:border-t-0 lg:border-l border-white/5 pt-6 lg:pt-0 lg:pl-8">
                {/* Competitor Intelligence Gallery */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Mappa Competitors Locali/Diretti
                    </h3>
                    <button
                      onClick={() => setActiveTab("intelligence")}
                      className="text-xs flex items-center gap-1 bg-primary hover:bg-primary/90 text-white border-none py-1.5 px-3 rounded-lg cursor-pointer font-bold active:scale-95 transition-all"
                    >
                      <Plus size={14} /> Gestisci
                    </button>
                  </div>

                  {/* Competitor reali — aggiunti dalla tab AI Intelligence */}
                  {client.intelligence?.competitors &&
                  client.intelligence.competitors.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {client.intelligence.competitors.map(
                        (c: any, i: number) => (
                          <div
                            key={i}
                            className="glass-card border border-white/5 bg-white/[0.02] p-4 rounded-xl flex gap-3 items-center hover:bg-white/[0.05] transition-colors shadow-sm"
                          >
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex-shrink-0 flex items-center justify-center text-indigo-400 font-extrabold text-base border border-indigo-500/10">
                              {c.name?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm text-foreground font-extrabold mb-0.5">
                                {c.name}
                              </div>
                              {c.insight && (
                                <div className="text-xs text-muted-foreground/80">
                                  {c.insight}
                                </div>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 px-4 gap-2 bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                      <Users size={28} className="opacity-20 text-foreground" />
                      <div className="text-xs font-bold text-muted-foreground">
                        Nessun competitor aggiunto
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 text-center">
                        Vai nella tab "AI Intelligence" per aggiungere i
                        competitor del cliente.
                      </div>
                    </div>
                  )}
                </div>

                {/* Trend Analysis */}
                <div>
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">
                    Integrazione Trend Locali
                  </h3>
                  <div className="flex flex-col items-center justify-center py-6 px-4 gap-2 bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                    <TrendingUp
                      size={28}
                      className="opacity-20 text-foreground"
                    />
                    <div className="text-xs font-bold text-muted-foreground">
                      Trend non disponibili
                    </div>
                    <div className="text-[10px] text-muted-foreground/80 text-center">
                      I trend di settore vengono generati automaticamente
                      dall'analisi AI Intelligence.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
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
                    btn.innerHTML = "Scansione in corso...";
                    const token = localStorage.getItem("token");
                    await fetch(
                      `${API_URL}/api/clients/${client.id}/intelligence/scan`,
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          name: client.name,
                          websiteUrl: client.websiteUrl,
                          industry: client.industry,
                        }),
                      },
                    );
                    window.location.reload();
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
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                        ✓ Sito Analizzato
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
                      <h4 className="text-[10px] font-black text-rose-400 mb-3 uppercase tracking-widest">
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
                      <h4 className="text-[10px] font-black text-emerald-400 mb-3 uppercase tracking-widest">
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
                                    {c.estimatedBudget && (
                                      <Badge
                                        variant="secondary"
                                        className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md"
                                      >
                                        Budget: {c.estimatedBudget}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteCompetitor(i)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all active:scale-95 cursor-pointer border-none"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white/[0.02] border border-white/8 p-3.5 rounded-xl space-y-1 border-l-2 border-l-emerald-500/60">
                                  <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3 w-3" /> Punti
                                    di forza
                                  </div>
                                  <div className="text-xs text-muted-foreground leading-relaxed font-medium">
                                    {c.strength || "—"}
                                  </div>
                                </div>
                                <div className="bg-white/[0.02] border border-white/8 p-3.5 rounded-xl space-y-1 border-l-2 border-l-rose-500/60">
                                  <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <AlertTriangle className="h-3 w-3" /> Punti
                                    deboli
                                  </div>
                                  <div className="text-xs text-muted-foreground leading-relaxed font-medium">
                                    {c.weakness || "—"}
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
                                    {c.adStyle || "Non ancora analizzato."}
                                  </span>
                                </div>
                              </div>

                              {/* Vision Upload Box */}
                              <div className="p-4 bg-white/[0.01] rounded-xl border border-dashed border-white/10 hover:border-white/20 transition-colors flex flex-col gap-3 relative group/upload">
                                <div className="flex items-center gap-2">
                                  <Brain className="h-4 w-4 text-indigo-400" />
                                  <span className="text-xs font-bold text-foreground">
                                    Analisi Inserzioni Attive (Screenshot AI)
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed m-0">
                                  Carica uno screenshot della Facebook Ads
                                  Library del competitor. Gemini Vision
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
                                      🤖 Lettura Vision in corso... (10s)
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
                    <div className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider mb-2">
                      Interessi Seed (Broad)
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {client.intelligence.metaInterests.map(
                        (interest: string, i: number) => (
                          <span
                            key={i}
                            className="text-[11px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full text-indigo-400 font-bold"
                          >
                            {interest}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider mb-2">
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
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-xl font-extrabold text-foreground">
              Campagne in Piattaforma
            </h2>
            <Link
              href={`/clients/${id}/meta-ads/new`}
              className="btn-gorgeous inline-flex items-center gap-2 no-underline text-xs font-bold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
            >
              <Plus size={16} /> Nuova Campagna
            </Link>
          </div>
          {(client.campaigns?.length || 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center justify-center gap-3 bg-white/[0.02] border border-white/5 rounded-2xl">
              <Zap size={40} className="opacity-20 text-muted-foreground" />
              <h3 className="font-bold text-foreground">
                Nessuna campagna ancora
              </h3>
              <p className="text-xs text-muted-foreground/60">
                Crea la prima campagna per questo cliente
              </p>
            </div>
          ) : (
            <div className="border border-white/10 rounded-2xl overflow-hidden glass-card bg-white/[0.02] shadow-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/15 bg-white/[0.04] text-[10px] font-black uppercase tracking-wider text-muted-foreground/75">
                    <th className="py-4.5 px-5">Nome Campagna</th>
                    <th className="py-4.5 px-4">Stato</th>
                    <th className="py-4.5 px-4">Obiettivo</th>
                    <th className="py-4.5 px-4">Budget / Giorno</th>
                    <th className="py-4.5 px-4">Varianti</th>
                    <th className="py-4.5 px-5 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-muted-foreground">
                  {(client.campaigns || []).map((c) => {
                    const s = statusColors[c.status] ?? {
                      color: "#94a3b8",
                      bg: "rgba(148,163,184,0.1)",
                      label: c.status,
                    };
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-white/[0.05] hover:shadow-md transition-all duration-200"
                      >
                        <td className="py-5 px-5 font-bold text-foreground flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary shrink-0" />
                          <span>{c.name}</span>
                        </td>
                        <td className="py-5 px-4">
                          <span
                            style={{
                              color: s.color,
                              backgroundColor: s.bg,
                              borderColor: `${s.color}25`,
                            }}
                            className="px-2.5 py-0.5 rounded-full font-extrabold text-[9px] tracking-wide uppercase border"
                          >
                            {s.label}
                          </span>
                        </td>
                        <td className="py-5 px-4 font-medium tracking-tight">
                          {c.objective}
                        </td>
                        <td className="py-5 px-4 font-extrabold text-foreground">
                          €{c.dailyBudget}/gg
                        </td>
                        <td className="py-5 px-4 font-semibold text-muted-foreground/90">
                          {c._count.adVariants} varianti
                        </td>
                        <td className="py-5 px-5 text-right">
                          <Link
                            href={`/clients/${id}/campaigns/${c.id}/preview`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/15 hover:bg-primary/20 hover:border-primary/25 transition-all hover:scale-102 hover:shadow-lg hover:shadow-primary/5 active:scale-95 no-underline"
                          >
                            Preview{" "}
                            <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sezione Campagne Meta Sincronizzate */}
          <div className="mt-12 pt-8 border-t border-white/5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold flex items-center gap-2 text-foreground">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <Image
                    src="https://upload.wikimedia.org/wikipedia/commons/7/7b/Meta_Platforms_Inc._logo.svg"
                    alt="Meta"
                    width={42}
                    height={14}
                    className="h-3.5 w-auto"
                    unoptimized
                  />{" "}
                  Sincronizzate da Meta
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Campagne attualmente attive sull'Ad Account configurato
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Filtra campagne (es. ODC)..."
                  value={campaignFilter}
                  onChange={(e) => {
                    setCampaignFilter(e.target.value);
                    localStorage.setItem(`meta_filter_${id}`, e.target.value);
                  }}
                  className="px-3 py-2 rounded-lg border border-white/10 bg-background/50 focus:border-primary/50 text-xs w-full sm:w-64 outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
                />
                {loadingMeta && (
                  <span className="text-xs text-muted-foreground/60 animate-pulse shrink-0">
                    Sincronizzazione...
                  </span>
                )}
              </div>
            </div>

            {!loadingMeta && metaCampaigns.length === 0 ? (
              <div className="text-center py-12 bg-background/20 rounded-2xl border border-white/5 text-muted-foreground/60 text-sm">
                Nessuna campagna trovata sull'account Meta corrente.
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto border border-white/10 rounded-2xl glass-card bg-white/[0.02] shadow-md scrollbar-thin">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-neutral-950/80 backdrop-blur-md border-b border-white/15 z-10 text-[10px] font-black uppercase tracking-wider text-muted-foreground/75">
                    <tr>
                      <th className="py-4.5 px-5">Nome (Meta)</th>
                      <th className="py-4.5 px-4">Stato</th>
                      <th className="py-4.5 px-4">Obiettivo</th>
                      <th className="py-4.5 px-4">Budget G. / Tot.</th>
                      <th className="py-4.5 px-5 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-muted-foreground">
                    {metaCampaigns
                      .filter((mc: any) =>
                        mc.name
                          .toLowerCase()
                          .includes(campaignFilter.toLowerCase()),
                      )
                      .map((mc: any) => {
                        const isActive = mc.status === "ACTIVE";
                        return (
                          <tr
                            key={mc.id}
                            className="hover:bg-white/[0.05] hover:shadow-md transition-all duration-200"
                          >
                            <td className="py-5 px-5 font-bold text-foreground">
                              {mc.name}
                            </td>
                            <td className="py-5 px-4">
                              <span
                                className={cn(
                                  "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase border",
                                  isActive
                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                                    : "text-muted-foreground bg-white/5 border-white/10",
                                )}
                              >
                                {mc.status}
                              </span>
                            </td>
                            <td className="py-5 px-4 font-semibold tracking-tight">
                              {mc.objective?.replace("OUTCOME_", "")}
                            </td>
                            <td className="py-5 px-4 font-extrabold text-foreground">
                              {mc.daily_budget
                                ? `€${(parseInt(mc.daily_budget) / 100).toFixed(2)}/gg`
                                : mc.lifetime_budget
                                  ? `€${(parseInt(mc.lifetime_budget) / 100).toFixed(2)} Tot`
                                  : "-"}
                            </td>
                            <td className="py-5 px-5 text-right">
                              <button
                                onClick={() =>
                                  handleOpenReport(mc.id, mc.objective, mc.name)
                                }
                                disabled={loadingReportId === mc.id}
                                className={cn(
                                  "py-2 px-4 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 active:scale-95 cursor-pointer hover:-translate-y-0.5",
                                  loadingReportId === mc.id
                                    ? "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5"
                                    : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 hover:bg-cyan-500/20 hover:border-cyan-500/25 hover:shadow-lg hover:shadow-cyan-500/5",
                                )}
                              >
                                {loadingReportId === mc.id ? (
                                  <Loader2
                                    size={12}
                                    className="animate-spin animate-duration-1000"
                                  />
                                ) : (
                                  <BarChart2 size={12} />
                                )}
                                <span>
                                  {loadingReportId === mc.id
                                    ? "Sincronizzazione..."
                                    : "Report KPI"}
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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

      <SeoGodModeReportModal
        isOpen={seoReportOpen}
        onClose={() => setSeoReportOpen(false)}
        clientId={client.id}
        clientName={client.name}
        websiteUrl={client.websiteUrl}
      />

      {/* TAB: BRAND ASSETS */}
      {activeTab === "assets" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-muted-foreground">
              Libreria creativa del cliente
            </p>
            <Link
              href={`/clients/${id}/brand-assets`}
              className="btn-gorgeous inline-flex items-center gap-2 no-underline text-xs font-bold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
            >
              <Plus size={16} /> Gestisci Assets
            </Link>
          </div>
          {(client.brandAssets?.length || 0) === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-background/20 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-3">
              Nessun asset caricato. Vai su "Gestisci Assets" per caricare
              immagini e video del cliente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(client.brandAssets || []).map((a) => {
                const isVideo = a.type?.toUpperCase() === "VIDEO";
                return (
                  <div
                    key={a.id}
                    className="glass-card p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:-translate-y-1 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col gap-4 group"
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={cn(
                          "text-[9px] uppercase font-extrabold tracking-wider border px-2.5 py-0.5 rounded-full",
                          isVideo
                            ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                            : "bg-pink-500/10 text-pink-400 border-pink-500/20",
                        )}
                      >
                        {a.type} · {a.format}
                      </span>
                      {a.isActive ? (
                        <CheckCircle2
                          size={16}
                          className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                        />
                      ) : (
                        <AlertTriangle
                          size={16}
                          className="text-rose-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]"
                        />
                      )}
                    </div>

                    {/* Visual Asset Container */}
                    <div className="relative aspect-video rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-950 border border-white/5 flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-pink-500/5 opacity-40 group-hover:opacity-60 transition-opacity" />
                      {isVideo ? (
                        <Video className="h-8 w-8 text-indigo-400/80 group-hover:text-indigo-400 transition-colors duration-300" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-pink-400/80 group-hover:text-pink-400 transition-colors duration-300" />
                      )}
                    </div>

                    <div className="font-extrabold text-sm text-foreground tracking-tight line-clamp-1">
                      {a.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
            <div className="flex-1 relative w-full aspect-video min-h-[600px] rounded-xl overflow-hidden border border-white/10 bg-white">
              <iframe
                src={`https://clarity.microsoft.com/embed/${client.clarityProjectId}`}
                className="absolute inset-0 w-full h-full border-0"
                title="Microsoft Clarity Dashboard"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB: GBP PROFILE */}
      {activeTab === "gbp" && (
        <GbpDashboardTab
          clientId={client.id}
          locations={client.gbpLocations ?? (client.gbpLocationId ? [{ id: client.gbpLocationId, name: 'Sede Principale' }] : [])}
          activeLocationId={client.gbpActiveLocationId ?? client.gbpLocationId ?? null}
        />
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
              hasTiktokToken:     client.hasTiktokToken     ?? false,
              tiktokDisplayName:  client.tiktokDisplayName  ?? null,
              hasLinkedinToken:   client.hasLinkedinToken   ?? false,
              linkedinOrgName:    client.linkedinOrgName    ?? null,
            }}
            onClientUpdated={() => window.location.reload()}
          />
        </div>
      )}
    </div>
  );
}

