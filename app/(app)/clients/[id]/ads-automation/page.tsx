"use client"

import React, { useState } from 'react'
import { Bot, Zap, Settings, Power, Activity, AlertTriangle, PlayCircle, History } from 'lucide-react'

export default function AdsAutomationPage({ params }: { params: { id: string } }) {
  // Mock states for the toggles
  const [googleScripts, setGoogleScripts] = useState({
    bidOptimizer: true,
    pmaxMonitor: true,
    negativeKw: false
  })
  
  const [metaRules, setMetaRules] = useState({
    pacingControl: true,
    cpaStopLoss: true,
    autoScaling: false
  })

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Bot size={32} color="#8b5cf6" />
          Hub Automazione Ads
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1rem' }}>
          Gestisci gli algoritmi proprietari e gli script che ottimizzano le campagne 24/7 per questo cliente.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* COLONNA SINISTRA: Moduli di Automazione */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* GOOGLE ADS AUTOMATION */}
          <div className="glass-table" style={{ padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#f59e0b', fontSize: '1.5rem' }}>G</span> Google Ads Scripts
              </h2>
              <span style={{ fontSize: '0.8rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                2 Script Attivi
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Script 1 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                <div>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Shopping Bid Optimizer <Zap size={14} color="#f59e0b" />
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Adegua le offerte CPC ogni ora in base al ROAS target storico.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Settings size={18} /></button>
                  <button 
                    onClick={() => setGoogleScripts(s => ({...s, bidOptimizer: !s.bidOptimizer}))}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', border: 'none',
                      background: googleScripts.bidOptimizer ? '#10b981' : 'rgba(0,0,0,0.2)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                      left: googleScripts.bidOptimizer ? 'calc(100% - 22px)' : '2px', transition: 'left 0.2s'
                    }} />
                  </button>
                </div>
              </div>

              {/* Script 2 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                <div>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>PMax Monitor & Advisory</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Analizza la dispersione di budget su reti non performanti nelle PMax.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Settings size={18} /></button>
                  <button 
                    onClick={() => setGoogleScripts(s => ({...s, pmaxMonitor: !s.pmaxMonitor}))}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', border: 'none',
                      background: googleScripts.pmaxMonitor ? '#10b981' : 'rgba(0,0,0,0.2)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                      left: googleScripts.pmaxMonitor ? 'calc(100% - 22px)' : '2px', transition: 'left 0.2s'
                    }} />
                  </button>
                </div>
              </div>

              {/* Script 3 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', opacity: googleScripts.negativeKw ? 1 : 0.6 }}>
                <div>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Negative KW Miner AI</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estrae e blocca automaticamente termini di ricerca inutili ogni 24h.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><Settings size={18} /></button>
                  <button 
                    onClick={() => setGoogleScripts(s => ({...s, negativeKw: !s.negativeKw}))}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', border: 'none',
                      background: googleScripts.negativeKw ? '#10b981' : 'rgba(0,0,0,0.2)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                      left: googleScripts.negativeKw ? 'calc(100% - 22px)' : '2px', transition: 'left 0.2s'
                    }} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* META ADS AUTOMATION */}
          <div className="glass-table" style={{ padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#3b82f6', fontSize: '1.5rem' }}>M</span> Meta Ads Rules
              </h2>
              <span style={{ fontSize: '0.8rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                2 Regole Attive
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                <div>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Budget Pacing Guardian</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Abbassa i budget giornalieri se la spesa supera il target mensile del 10%.</p>
                </div>
                <button 
                  onClick={() => setMetaRules(s => ({...s, pacingControl: !s.pacingControl}))}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', border: 'none',
                    background: metaRules.pacingControl ? '#10b981' : 'rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                    left: metaRules.pacingControl ? 'calc(100% - 22px)' : '2px', transition: 'left 0.2s'
                  }} />
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                <div>
                  <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>CPA Stop-Loss</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mette in pausa gli ad set se il CPA supera i 45€ per 3 giorni consecutivi.</p>
                </div>
                <button 
                  onClick={() => setMetaRules(s => ({...s, cpaStopLoss: !s.cpaStopLoss}))}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', border: 'none',
                    background: metaRules.cpaStopLoss ? '#10b981' : 'rgba(0,0,0,0.2)'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                    left: metaRules.cpaStopLoss ? 'calc(100% - 22px)' : '2px', transition: 'left 0.2s'
                  }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: Log e Stato Sistema */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="glass-table" style={{ padding: '2rem', borderRadius: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Power size={18} color="#10b981" /> Stato Motore AI
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Latenza Server</span>
                <span style={{ fontWeight: 600 }}>45ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ultimo Sync Google Ads</span>
                <span style={{ fontWeight: 600 }}>12 min fa</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ultimo Sync Meta Ads</span>
                <span style={{ fontWeight: 600 }}>5 min fa</span>
              </div>
              <button className="primary-btn" style={{ width: '100%', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                <PlayCircle size={16} /> Esegui Tutti gli Script Ora
              </button>
            </div>
          </div>

          <div className="glass-table" style={{ padding: '2rem', borderRadius: '16px', flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={18} color="#f59e0b" /> Log Interventi Recenti
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', marginTop: 6 }}></div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Shopping Bid Optimizer</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Aumentato CPC del +15% per &quot;iPhone 15&quot; causa alto ROAS odierno.</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Oggi, 14:30</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginTop: 6 }}></div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Budget Pacing Guardian</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Ridotto budget &quot;Campagna Retargeting&quot; da 50€ a 42€/gg.</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Oggi, 09:00</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginTop: 6 }}></div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>CPA Stop-Loss</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Pausato Ad Set &quot;Broad Audience&quot;. CPA oltre soglia (52€).</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Ieri, 23:45</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
