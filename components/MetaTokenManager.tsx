'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Shield } from 'lucide-react';

interface TokenStatus {
  configured: boolean;
  valid: boolean;
  expired?: boolean;
  userName?: string;
  userId?: string;
  accountId?: string;
  pageId?: string;
  expiresAt?: string;
  daysLeft?: number | null;
  expiresNever?: boolean;
  message?: string;
  error?: string;
}

interface MetaTokenManagerProps {
  clientId: string;
}

export function MetaTokenManager({ clientId }: MetaTokenManagerProps) {
  const { authFetch } = useAuthFetch();
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Form
  const [newToken, setNewToken] = useState('');
  const [newAccountId, setNewAccountId] = useState('');
  const [newPageId, setNewPageId] = useState('');
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/clients/${clientId}/meta/token`);
      const data = await res.json();
      setStatus(data);
      // Pre-fill form with existing values
      if (data.accountId) setNewAccountId(data.accountId);
      if (data.pageId) setNewPageId(data.pageId);
    } catch (e) {
      setStatus({ configured: false, valid: false, error: 'Errore nel recupero stato token' });
    } finally {
      setLoading(false);
    }
  }, [clientId, authFetch]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSave = async () => {
    if (!newToken.trim()) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await authFetch(`/api/clients/${clientId}/meta/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: newToken.trim(),
          accountId: newAccountId.trim(),
          pageId: newPageId.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveResult({ ok: true, message: data.message || 'Token salvato!' });
        setNewToken('');
        fetchStatus();
        setTimeout(() => setExpanded(false), 1500);
      } else {
        setSaveResult({ ok: false, message: data.error || data.details || 'Errore nel salvataggio' });
      }
    } catch (e: any) {
      setSaveResult({ ok: false, message: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Render States ──────────────────────────────────────────────────────────

  const getBadge = () => {
    if (loading) return <Badge variant="secondary" className="text-xs"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Verifica...</Badge>;
    if (!status?.configured) return <Badge variant="secondary" className="text-xs">⚪ Non configurato</Badge>;
    if (!status.valid || status.expired) return <Badge variant="destructive" className="text-xs"><AlertCircle className="h-3 w-3 mr-1" />Token scaduto</Badge>;
    if (status.daysLeft !== null && status.daysLeft !== undefined && status.daysLeft < 7) {
      return <Badge className="bg-amber-500 text-white text-xs"><Clock className="h-3 w-3 mr-1" />Scade in {status.daysLeft}gg</Badge>;
    }
    if (status.expiresNever) return <Badge className="bg-emerald-500 text-white text-xs"><Shield className="h-3 w-3 mr-1" />Token Permanente</Badge>;
    return <Badge className="bg-emerald-500 text-white text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Attivo ({status.daysLeft}gg)</Badge>;
  };

  const showWarning = status && (!status.valid || status.expired || (status.daysLeft !== null && status.daysLeft !== undefined && status.daysLeft < 7));

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${showWarning ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border bg-card'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </div>
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              Integrazione Meta {getBadge()}
            </div>
            {status?.valid && status.userName && (
              <div className="text-xs text-muted-foreground">Account: {status.userName}</div>
            )}
            {!loading && !status?.valid && (
              <div className="text-xs text-red-600 dark:text-red-400 font-medium">{status?.message || 'Token non valido'}</div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(v => !v)}
          className="shrink-0 h-8 px-2"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="ml-1 text-xs">{expanded ? 'Chiudi' : 'Gestisci'}</span>
        </Button>
      </div>

      {/* Warning Banner */}
      {showWarning && !expanded && (
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-lg p-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {status?.expired || !status?.valid
              ? 'Il token è scaduto. I report non mostrano dati.'
              : typeof status?.daysLeft === 'number'
                ? `Il token scade tra ${status.daysLeft} giorni.`
                : 'Token in scadenza.'}
            {' '}<button onClick={() => setExpanded(true)} className="underline font-semibold">Rinnova ora →</button>
          </span>
        </div>
      )}

      {/* Expanded Panel */}
      {expanded && (
        <div className="space-y-4 pt-2 border-t">
          {/* Current info */}
          {status?.configured && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              {status.accountId && <div><span className="font-medium text-foreground">Ad Account:</span> {status.accountId}</div>}
              {status.pageId && <div><span className="font-medium text-foreground">Page ID:</span> {status.pageId}</div>}
              {status.expiresAt && <div><span className="font-medium text-foreground">Scadenza:</span> {new Date(status.expiresAt).toLocaleDateString('it-IT')}</div>}
              {status.expiresNever && <div><span className="font-medium text-foreground">Tipo:</span> System User Token (non scade)</div>}
            </div>
          )}

          {/* Guide */}
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-foreground mb-1">📖 Come ottenere un token che non scade:</div>
            <div>1. Vai su <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">Business Manager → System Users <ExternalLink className="h-2.5 w-2.5"/></a></div>
            <div>2. Crea un System User → assegna il tuo account Ads e la Pagina</div>
            <div>3. Genera token → seleziona permessi: <code className="bg-muted px-1 rounded">ads_read</code>, <code className="bg-muted px-1 rounded">pages_read_engagement</code>, <code className="bg-muted px-1 rounded">instagram_basic</code></div>
            <div>4. Incolla il token qui sotto</div>
            <div className="pt-1">
              <span className="font-medium">In alternativa (token temporaneo 60gg):</span>{' '}
              <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline inline-flex items-center gap-0.5">Graph API Explorer <ExternalLink className="h-2.5 w-2.5"/></a>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Access Token *</Label>
              <Input
                placeholder="EAABwzLixnjYBO..."
                value={newToken}
                onChange={e => setNewToken(e.target.value)}
                className="mt-1 font-mono text-xs"
                type="password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Ad Account ID</Label>
                <Input
                  placeholder="act_123456789"
                  value={newAccountId}
                  onChange={e => setNewAccountId(e.target.value)}
                  className="mt-1 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Es: act_521414698671784</p>
              </div>
              <div>
                <Label className="text-xs font-semibold">Facebook Page ID</Label>
                <Input
                  placeholder="115056816525065"
                  value={newPageId}
                  onChange={e => setNewPageId(e.target.value)}
                  className="mt-1 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Serve per FB + IG report</p>
              </div>
            </div>

            {saveResult && (
              <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${saveResult.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                {saveResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                {saveResult.message}
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || !newToken.trim()}
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />Verifica e salva...</> : 'Verifica e salva token'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
