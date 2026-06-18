import React, { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  MapPin,
  MessageSquareHeart,
  Search,
  FileBarChart,
  Megaphone,
  Star,
  Sparkles,
  TrendingUp,
  Download,
  Calendar,
  Settings
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface GbpDashboardProps {
  clientId: string
}

type TabType = 'overview' | 'directories' | 'reviews' | 'seo' | 'reporting' | 'content'

export default function GbpDashboardTab({ clientId }: GbpDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [daysBack, setDaysBack] = useState(30)
  
  // Per ora usiamo questi mock per costruire la UI senza errori, 
  // in attesa dell'approvazione delle API da parte di Google.
  const insights = {
    totalImpressions: 42560,
    totalActions: 1245,
    websiteClicks: 450,
    phoneCalls: 320,
    directionRequests: 475
  }
  
  const reviews = {
    totalReviews: 124,
    unansweredCount: 12,
    averageRating: 4.8,
    recent: [
      { author: "Maria R.", rating: 5, text: "Servizio eccellente e personale molto cordiale. Ci tornerò sicuramente!", date: "2 giorni fa" },
      { author: "Luca B.", rating: 4, text: "Buona esperienza, prezzi onesti ma attesa un po' lunga.", date: "5 giorni fa" },
      { author: "Giulia F.", rating: 5, text: "Siete fantastici! Consiglio a tutti.", date: "1 settimana fa" }
    ]
  }

  const keywords = [
    { keyword: "ristorante vicino a me", impressions: 1240 },
    { keyword: "pizza asporto", impressions: 980 },
    { keyword: "cena aziendale", impressions: 450 }
  ]
  
  const healthScore = 85

  // Sotto-componenti per le singole TAB
  const renderOverview = () => (
    <div className="tab-content-animation">
      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Impressioni Totali</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: '#f59e0b' }}>
            {insights.totalImpressions.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <TrendingUp size={12} /> +15% vs mese prec.
          </span>
        </div>

        <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Azioni Totali</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: '#10b981' }}>
            {insights.totalActions.toLocaleString()}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
            {insights.websiteClicks} Click Sito • {insights.phoneCalls} Chiamate
          </span>
        </div>

        <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Richieste Indicazioni</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: '#3b82f6' }}>
            {insights.directionRequests.toLocaleString()}
          </span>
        </div>

        <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Recensioni (Mese)</span>
          <span style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: '#8b5cf6' }}>
            +14
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
            Media: ⭐ {reviews.averageRating.toFixed(1)} su {reviews.totalReviews} totali
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Timeline Chart Mockup */}
        <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Timeline Impressioni (Ultimi {daysBack} gg)</h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '4px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            {/* Mock bars */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{ 
                flex: 1, 
                backgroundColor: i % 3 === 0 ? 'rgba(59, 130, 246, 0.4)' : 'rgba(245, 158, 11, 0.4)', 
                height: `${Math.floor(Math.random() * 60) + 40}%`, 
                borderRadius: '4px 4px 0 0' 
              }}></div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem', fontSize: '0.8rem' }}>
             <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ width: 10, height: 10, background: 'rgba(245, 158, 11, 0.4)', borderRadius: '2px' }}></span> Google Maps</span>
             <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span style={{ width: 10, height: 10, background: 'rgba(59, 130, 246, 0.4)', borderRadius: '2px' }}></span> Google Search</span>
          </div>
        </div>

        {/* AI Visibility & Health Score */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>SEO Local Score</h3>
            <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
               <div style={{ width: `${healthScore}%`, height: '100%', background: healthScore > 70 ? '#10b981' : '#f59e0b' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
              <span>Profilo Ottimizzato al {healthScore}%</span>
            </div>
            <ul style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✅ NAP Sincronizzato</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>❌ Rispondi a {reviews.unansweredCount} recensioni</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✅ Prodotti/Servizi Aggiornati</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )

  const renderDirectories = () => (
    <div className="tab-content-animation glass-table" style={{ padding: '2rem', borderRadius: '16px' }}>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MapPin size={20} color="#f59e0b" /> Gestione Sedi & Directory
      </h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Mantieni le informazioni aziendali (NAP) sincronizzate su Google Maps e altri network locali.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', color: 'var(--text-secondary)', textAlign: 'left' }}>
            <th style={{ padding: '1rem' }}>Network</th>
            <th style={{ padding: '1rem' }}>Stato Sincronizzazione</th>
            <th style={{ padding: '1rem' }}>Ultimo Aggiornamento</th>
            <th style={{ padding: '1rem', textAlign: 'right' }}>Azione</th>
          </tr>
        </thead>
        <tbody>
          {['Google Business Profile', 'Apple Maps', 'Bing Places'].map((network, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <td style={{ padding: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: idx === 0 ? '#10b981' : '#f59e0b' }}></div>
                {network}
              </td>
              <td style={{ padding: '1rem' }}>
                {idx === 0 ? <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Sincronizzato</span> : <span style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>In sospeso</span>}
              </td>
              <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Oggi, 10:45</td>
              <td style={{ padding: '1rem', textAlign: 'right' }}>
                <button className="primary-btn" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Modifica Dati</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderReviews = () => (
    <div className="tab-content-animation">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquareHeart size={20} color="#f59e0b" /> Reputation Management
        </h3>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <select style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.05)', fontSize: '0.9rem' }}>
            <option>Tutte le recensioni ({reviews.totalReviews})</option>
            <option>Da rispondere ({reviews.unansweredCount})</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {reviews.recent.map((rev, idx) => (
          <div key={idx} className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {rev.author.charAt(0)}
                </div>
                <div>
                  <h4 style={{ fontWeight: 600 }}>{rev.author}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rev.date} sulla sede principale</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={16} fill={i < rev.rating ? "#f59e0b" : "transparent"} color={i < rev.rating ? "#f59e0b" : "#ccc"} />
                ))}
              </div>
            </div>
            <p style={{ fontSize: '0.95rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>"{rev.text}"</p>
            
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}>
                <Sparkles size={16} /> Genera Risposta AI
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderSeo = () => (
    <div className="tab-content-animation" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={18} color="#f59e0b" /> Termini di Ricerca Top
          </h3>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>Keyword</th>
                <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>Impressioni</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{kw.keyword}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{kw.impressions.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={18} color="#8b5cf6" /> AI Visibility Tracker
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Come i motori di intelligenza artificiale raccomandano il tuo brand nelle ricerche locali.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span style={{ fontSize: '1.2rem' }}>🤖</span> <strong>ChatGPT</strong></div>
               <span style={{ color: '#10b981', fontWeight: 'bold' }}>Raccomandato (Score: 78/100)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span style={{ fontSize: '1.2rem' }}>🧠</span> <strong>Perplexity</strong></div>
               <span style={{ color: '#10b981', fontWeight: 'bold' }}>Raccomandato (Score: 82/100)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><span style={{ fontSize: '1.2rem' }}>✨</span> <strong>Google Gemini</strong></div>
               <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Non Raccomandato (Score: 35/100)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-table" style={{ padding: '1.5rem', borderRadius: '16px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={18} color="#f59e0b" /> Geo-Grid Local Rank Tracker (Anteprima)
        </h3>
        <div style={{ height: '250px', background: 'rgba(0,0,0,0.02)', border: '1px dashed rgba(0,0,0,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-tertiary)' }}>
          <MapPin size={40} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <span>Mappa termica delle posizioni in caricamento...</span>
          <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Permette di vedere il ranking esatto via per via contro i competitor locali.</span>
        </div>
      </div>
    </div>
  )

  const renderReporting = () => (
    <div className="tab-content-animation glass-table" style={{ padding: '2rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileBarChart size={20} color="#f59e0b" /> Reportistica Automatica
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Genera e invia report PDF brandizzati ai tuoi clienti per dimostrare il ROI.
          </p>
        </div>
        <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={18} /> Genera Report Mese Scorso
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div style={{ padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="#8b5cf6" /> Sintesi AI del Mese (Anteprima per il Report)
          </h4>
          <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
            "Nel mese di Maggio, la scheda Google Business Profile ha registrato un <strong>incremento del 15% nelle impressioni totali</strong> rispetto ad Aprile. Particolarmente positiva la crescita delle ricerche su Google Maps (+22%), che si è tradotta in <strong>475 richieste di indicazioni stradali</strong>. La reputazione online si mantiene eccellente (4.8/5) grazie a 14 nuove recensioni ricevute."
          </p>
        </div>

        <div style={{ padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} /> Impostazioni Invio Automatico
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: 44, height: 24, borderRadius: '12px', background: '#10b981', position: 'relative', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }}></div>
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Invio automatico attivo</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Il report verrà inviato automaticamente all'email del cliente ogni 1° del mese alle 09:00 AM.</p>
        </div>
      </div>
    </div>
  )

  const renderContent = () => (
    <div className="tab-content-animation glass-table" style={{ padding: '2rem', borderRadius: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Megaphone size={20} color="#f59e0b" /> Gestione Contenuti & Post
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.95rem' }}>
            Crea, programma e pubblica Aggiornamenti, Offerte ed Eventi sulla tua scheda Google.
          </p>
        </div>
        <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
          + Nuovo Post
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', display: 'flex', gap: '1.5rem' }}>
          <div style={{ width: 120, height: 120, background: 'rgba(0,0,0,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            📸 Immagine
          </div>
          <div style={{ flex: 1 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Offerta</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Pubblicato: Ieri, 15:30</span>
             </div>
             <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Menu Speciale Weekend: Sconto 20%</h4>
             <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Vieni a provare il nostro nuovo menu speciale questo weekend! Approfitta del 20% di sconto mostrando questo post alla cassa.</p>
             <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
               <span>👁️ 145 Visualizzazioni</span>
               <span>👆 12 Click</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  )

  // MAIN RENDER
  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* TODO: rimuovere quando API Google Business Profile è approvata */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
        <span>⚠️</span>
        <span>Dati dimostrativi — API Google Business Profile non ancora attiva</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Profilo <span style={{ color: '#f59e0b' }}>GBP</span></h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Centro di comando Local SEO (Modo: Anteprima Grafica)</p>
        </div>
        
        {/* TOP CONTROLS */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {activeTab === 'overview' && (
            <select 
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.05)', fontSize: '0.9rem', outline: 'none' }}
            >
              <option value={7}>Ultimi 7 giorni</option>
              <option value={30}>Ultimi 30 giorni</option>
              <option value={90}>Ultimi 90 giorni</option>
              <option value={180}>Ultimi 6 mesi</option>
              <option value={365}>Ultimo Anno (Premium)</option>
            </select>
          )}
          <button className="primary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(0,0,0,0.1)' }}>
            <Settings size={18} /> Configura Sede
          </button>
        </div>
      </div>

      {/* HORIZONTAL TAB NAVIGATION */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        {[
          { id: 'overview', label: 'Overview & KPI', icon: <LayoutDashboard size={16} /> },
          { id: 'directories', label: 'Sedi & Directory', icon: <MapPin size={16} /> },
          { id: 'reviews', label: 'Recensioni & AI', icon: <MessageSquareHeart size={16} /> },
          { id: 'seo', label: 'Local SEO & Competitor', icon: <Search size={16} /> },
          { id: 'reporting', label: 'Reportistica', icon: <FileBarChart size={16} /> },
          { id: 'content', label: 'Post & Contenuti', icon: <Megaphone size={16} /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'var(--card-bg)' : 'transparent',
              color: activeTab === tab.id ? '#f59e0b' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === tab.id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* RENDER ACTIVE TAB */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'directories' && renderDirectories()}
        {activeTab === 'reviews' && renderReviews()}
        {activeTab === 'seo' && renderSeo()}
        {activeTab === 'reporting' && renderReporting()}
        {activeTab === 'content' && renderContent()}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .tab-content-animation {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  )
}
