"use client"

import { X, TrendingUp, Target, Users, Zap, ExternalLink, Calendar, HandCoins, Activity, ShoppingCart } from 'lucide-react'
import { useState } from 'react'

interface MetaCampaignReportModalProps {
  onClose: () => void;
  campaignTitle: string;
  objective: string;
  baseMetrics: any;
  specificMetrics: any;
  datePreset: string;
  onDateChange: (preset: string) => void;
  isLoading?: boolean;
}

export default function MetaCampaignReportModal({ onClose, campaignTitle, objective, baseMetrics, specificMetrics, datePreset, onDateChange, isLoading }: MetaCampaignReportModalProps) {
  
  const metricCard = (title: string, value: string | number, subvalue?: string, icon?: any) => (
    <div style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', padding: '1.25rem', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', opacity: 0.2 }}>{icon}</div>
      <h4 style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{title}</h4>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{value}</div>
      {subvalue && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{subvalue}</div>}
    </div>
  )

  // I valori che Windsor non ha per questa campagna arrivano null: si mostra «—», mai NaN o un errore
  const num = (v: any, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—')
  const eur = (v: any, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? `€${num(v, d)}` : '—')
  const pct = (v: any, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${num(v, d)}%` : '—')
  const sp = specificMetrics || {}

  const renderSpecifics = () => {
    switch (objective) {
      case 'SALES':
      case 'CATALOG_SALES':
        return (
          <>
            {metricCard('ROAS (Ritorno Spesa)', typeof sp.roas === 'number' ? `x${num(sp.roas, 2)}` : '—', `Target: > 3,00`, <TrendingUp size={32}/>)}
            {metricCard('Acquisti', num(sp.purchases), `Costo per acquisto: ${eur(sp.costPerPurchase)}`, <ShoppingCart size={32}/>)}
            {metricCard('Valore Conversioni', eur(sp.purchaseValue), `Generato`, <HandCoins size={32}/>)}
            {metricCard('Add to Cart', num(sp.addToCarts), `Checkout: ${num(sp.checkoutsInitiated)}`, <Activity size={32}/>)}
          </>
        )
      case 'LEADS':
         return (
          <>
            {metricCard('Volume Lead', num(sp.leads), `Totale contatti acquisiti`, <Users size={32}/>)}
            {metricCard('Costo per Lead (CPL)', eur(sp.costPerLead), `Costo medio acquisizione`, <Target size={32}/>)}
            {metricCard('Da click a lead', pct(sp.formCompletionRate), `Lead sui click totali`, <Activity size={32}/>)}
          </>
        )
      case 'TRAFFIC':
         return (
          <>
            {metricCard('Click in Uscita', num(sp.outboundClicks), `Visite indirizzate al sito`, <ExternalLink size={32}/>)}
            {metricCard('CTR Uscita', pct(sp.outboundCtr, 2), `Media di mercato: 1%`, <TrendingUp size={32}/>)}
            {metricCard('Costo per Click in uscita', eur(sp.costPerOutboundClick), `Visualizzazioni pagina: ${num(sp.landingPageViews)}`, <Target size={32}/>)}
          </>
        )
      case 'ENGAGEMENT':
         return (
          <>
            {metricCard('Interazioni Post', num(sp.postEngagements), `Costo per interazione: ${eur(sp.costPerEngagement, 3)}`, <Activity size={32}/>)}
            {metricCard('Reazioni', num(sp.reactions), `${num(sp.postComments)} commenti | ${num(sp.postShares)} condivisioni`, <Users size={32}/>)}
            {metricCard('Messaggi Avviati', num(sp.messages), `Conversazioni iniziate`, <Zap size={32}/>)}
            {metricCard('Visualizzazioni Video', num(sp.videoViews), `Riproduzioni`, <Target size={32}/>)}
          </>
        )
      case 'AWARENESS':
         return (
          <>
            {metricCard('Copertura (Reach)', num(sp.reach), `Persone uniche raggiunte`, <Users size={32}/>)}
            {metricCard('Visualizzazioni Video', num(sp.videoViews), `Riproduzioni`, <Target size={32}/>)}
          </>
        )
      default:
        return (
          <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
            Nessun KPI specifico per questo obiettivo ({objective}): qui sotto trovi le metriche di consegna.
          </div>
        )
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 50px rgba(0,0,0,0.1)' }}>
        
        {/* Header Modale */}
        <div style={{ padding: '2rem 2.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#fafafa', borderRadius: '24px 24px 0 0' }}>
          <div>
             <div style={{ display: 'inline-block', background: 'var(--brand-fuchsia)', color: 'white', fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', borderRadius: '50px', marginBottom: '1rem', letterSpacing: '0.05em' }}>
               OBIETTIVO: {objective}
             </div>
             <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.2 }}>{campaignTitle}</h2>
             <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <Calendar size={14} />
               <select 
                 value={datePreset}
                 onChange={(e) => onDateChange(e.target.value)}
                 disabled={isLoading}
                 style={{
                   border: 'none', background: 'transparent', color: 'var(--text-primary)',
                   fontSize: '0.9rem', outline: 'none', cursor: isLoading ? 'wait' : 'pointer',
                   fontWeight: 700, borderBottom: '1px dashed rgba(0,0,0,0.3)', paddingBottom: '2px'
                 }}
               >
                 <option value="today">Oggi</option>
                 <option value="yesterday">Ieri</option>
                 <option value="last_7d">Ultimi 7 giorni</option>
                 <option value="last_30d">Ultimi 30 giorni</option>
                 <option value="this_month">Questo mese</option>
                 <option value="last_month">Mese scorso</option>
                 <option value="maximum">Massimo (All Time)</option>
               </select>
               {isLoading && <span style={{fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, animation: 'pulse 1.5s infinite'}}>Ricalcolo KPI...</span>}
             </span>
          </div>
          <button onClick={onClose} style={{ background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
            <X size={20} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '2.5rem' }}>
          
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}> KPI Primari ({objective})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
            {renderSpecifics()}
          </div>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}> Metriche Base (Delivery)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {metricCard('Spesa Totale', eur(baseMetrics?.spend))}
            {metricCard('Impression', num(baseMetrics?.impressions))}
            {metricCard('Frequenza', num(baseMetrics?.frequency, 2))}
            {metricCard('CPM Medio', eur(baseMetrics?.cpm))}
            
            {metricCard('Click Totali', num(baseMetrics?.clicks))}
            {metricCard('CTR Globale', pct(baseMetrics?.ctr, 2))}
            {metricCard('Costo per Click', eur(baseMetrics?.cpc))}
          </div>
        </div>
      </div>
    </div>
  )
}
