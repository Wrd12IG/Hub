"use client"

import { useState, useCallback, useEffect } from 'react'
import { Instagram, Grid, Plus, X, Trash2, Check, Hash, Sparkles, BookOpen } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getAuthHeader } from '@/hooks/use-auth-token'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ═══════════════════════════════════════════════════════════════
// INSTAGRAM GRID PREVIEW
// Shows how a new post looks inside the 3-column profile grid
// ═══════════════════════════════════════════════════════════════

interface GridPreviewProps {
  newMediaUrl?: string   // The new post being composed
  postType?: string
  igAccountId?: string   // If provided, fetches real recent media from IG
  token?: string
}

export function InstagramGridPreview({ newMediaUrl, postType, igAccountId, token }: GridPreviewProps) {
  const [recentMedia, setRecentMedia] = useState<Array<{ id: string; mediaUrl: string; mediaType: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!igAccountId || !token) {
      // Use placeholder grid cells when no real account is connected
      setRecentMedia([])
      return
    }
    setLoading(true)
    fetch(`${API_URL}/api/instagram/recent-media?accountId=${igAccountId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setRecentMedia(data.slice(0, 11)))
      .catch(() => setRecentMedia([]))
      .finally(() => setLoading(false))
  }, [igAccountId, token])

  // Build 12-cell grid: new post in position 0 (top-left = most recent)
  const gridCells = Array.from({ length: 12 }, (_, i) => {
    if (i === 0) return { isNew: true, url: newMediaUrl, type: postType }
    const existing = recentMedia[i - 1]
    return existing ? { isNew: false, url: existing.mediaUrl, type: existing.mediaType } : { isNew: false, url: null }
  })

  const isStory = postType === 'STORY'
  const isReel  = postType === 'REEL'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Grid size={14} color="#e1306c" />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e1306c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Grid Preview
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
          Come apparirà nel profilo
        </span>
      </div>

      {/* Stories/Reels note */}
      {(isStory || isReel) && (
        <div style={{ padding: '6px 10px', background: 'rgba(225,48,108,0.06)', borderRadius: '8px', fontSize: '0.7rem', color: '#e1306c', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Instagram size={11} />
          {isStory ? 'Le Stories non appaiono nel grid — scadono dopo 24h' : 'I Reels appaiono nel grid con un\'icona ▶'}
        </div>
      )}

      {/* 3-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '2px',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.08)',
      }}>
        {gridCells.map((cell, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              aspectRatio: '1',
              background: cell.isNew
                ? 'linear-gradient(135deg, rgba(225,48,108,0.1), rgba(131,58,180,0.1))'
                : '#f5f5f5',
              overflow: 'hidden',
            }}
          >
            {cell.url ? (
              <>
                {(cell.type === 'VIDEO' || cell.type === 'REEL') ? (
                  <video src={cell.url}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    muted playsInline />
                ) : (
                  <img src={cell.url} alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                )}

                {/* New post badge */}
                {cell.isNew && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    border: '3px solid #e1306c',
                    borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ background: '#e1306c', borderRadius: '4px', padding: '2px 6px', fontSize: '0.55rem', fontWeight: 800, color: '#fff' }}>
                      NUOVO
                    </div>
                  </div>
                )}

                {/* Reel icon */}
                {(cell.type === 'REEL' || cell.type === 'VIDEO') && !cell.isNew && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px' }}>
                    <span style={{ fontSize: '0.7rem' }}>▶</span>
                  </div>
                )}
              </>
            ) : cell.isNew ? (
              /* New post placeholder (no image yet) */
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px dashed #e1306c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={14} color="#e1306c" />
                </div>
                <span style={{ fontSize: '0.55rem', color: '#e1306c', fontWeight: 600 }}>Nuovo post</span>
              </div>
            ) : (
              /* Empty grid cell placeholder */
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #f0f0f0, #e8e8e8)' }} />
            )}
          </div>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
          Caricamento griglia dal profilo Instagram...
        </div>
      )}

      {!igAccountId && !loading && (
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
          Collega l&apos;account Instagram per vedere la griglia reale del profilo.
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HASHTAG MANAGER
// Save, load, and insert hashtag groups
// ═══════════════════════════════════════════════════════════════

interface HashtagGroup {
  id: string
  name: string
  hashtags: string[]
  usageCount: number
}

interface HashtagManagerProps {
  clientId: string
  currentHashtags: string    // Current hashtag string in the editor
  onApply: (tags: string) => void  // Called when user selects a group
}

export function HashtagManager({ clientId, currentHashtags, onApply }: HashtagManagerProps) {
  const { toast } = useToast()
  const [groups, setGroups] = useState<HashtagGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupTags, setNewGroupTags] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/hashtag-groups`, {
        headers: { ...getAuthHeader() }
      })
      if (res.ok) setGroups(await res.json())
    } catch (error) {
      console.error('[InstagramTools] request failed:', error)
      toast({ title: 'Errore', description: 'Richiesta non completata', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [clientId])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const handleSaveGroup = async () => {
    if (!newGroupName.trim() || !newGroupTags.trim()) return
    setSaving(true)
    const hashtags = newGroupTags.split(/[\s,]+/).filter(t => t.startsWith('#') || t.match(/^\w/)).map(t => t.startsWith('#') ? t : `#${t}`)
    try {
      await fetch(`${API_URL}/api/clients/${clientId}/hashtag-groups`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, hashtags })
      })
      setNewGroupName('')
      setNewGroupTags('')
      setShowForm(false)
      await fetchGroups()
    } catch (error) {
      console.error('[InstagramTools] request failed:', error)
      toast({ title: 'Errore', description: 'Richiesta non completata', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDeleteGroup = async (id: string) => {
    await fetch(`${API_URL}/api/clients/${clientId}/hashtag-groups/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    })
    await fetchGroups()
  }

  const handleApplyGroup = async (group: HashtagGroup) => {
    const existing = currentHashtags.trim()
    const incoming = group.hashtags.join(' ')
    const combined = existing ? `${existing} ${incoming}` : incoming
    onApply(combined)
    // Track usage
    fetch(`${API_URL}/api/clients/${clientId}/hashtag-groups/${group.id}/use`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    }).catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

      {/* Header + Create button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Hash size={13} color="#e1306c" />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e1306c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Hashtag Groups
        </span>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(225,48,108,0.3)', background: 'rgba(225,48,108,0.06)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600, color: '#e1306c' }}
        >
          <Plus size={10} /> Nuovo gruppo
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'rgba(225,48,108,0.05)', border: '1px solid rgba(225,48,108,0.15)', borderRadius: '9px', padding: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <input
            value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
            placeholder="Nome gruppo (es. Fitness Core)"
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none' }}
          />
          <textarea
            value={newGroupTags} onChange={e => setNewGroupTags(e.target.value)}
            placeholder="#hashtag1 #hashtag2 #hashtag3 ..."
            rows={2}
            style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '6px', padding: '5px 8px', fontSize: '0.78rem', outline: 'none', resize: 'vertical', fontFamily: 'monospace', color: '#a78bfa' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '4px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Annulla</button>
            <button onClick={handleSaveGroup} disabled={saving} style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#e1306c', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
              {saving ? 'Salvo...' : 'Salva'}
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      {loading ? (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', padding: '4px 0' }}>Caricamento gruppi...</div>
      ) : groups.length === 0 ? (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
          Nessun gruppo salvato. Crea il tuo primo set di hashtag!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
          {groups.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: '7px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <BookOpen size={11} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</div>
                <div style={{ fontSize: '0.62rem', color: '#a78bfa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.hashtags.join(' ')}</div>
              </div>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>×{g.usageCount}</span>
              <button
                onClick={() => handleApplyGroup(g)}
                style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 7px', borderRadius: '5px', border: 'none', background: 'rgba(225,48,108,0.1)', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700, color: '#e1306c', flexShrink: 0 }}
              >
                <Check size={9} /> Inserisci
              </button>
              <button
                onClick={() => handleDeleteGroup(g.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '2px', flexShrink: 0 }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ASPECT RATIO VALIDATOR
// Shows a warning bar when the uploaded image doesn't fit IG specs
// ═══════════════════════════════════════════════════════════════

interface AspectRatioWarningProps {
  mediaUrl?: string
  postType: string
}

export function AspectRatioWarning({ mediaUrl, postType }: AspectRatioWarningProps) {
  const [warning, setWarning] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    if (!mediaUrl || !mediaUrl.startsWith('blob:')) {
      setWarning(null); setOk(null); return
    }
    // Only check images — video ratio check would need video duration
    if (/\.(mp4|webm|mov)$/i.test(mediaUrl)) {
      setWarning(null); setOk(null); return
    }

    const img = new Image()
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      const ratio = w / h

      const rules: Record<string, Array<{ label: string; ratio: number; tol: number }>> = {
        PHOTO: [
          { label: '4:5 (verticale)', ratio: 0.8, tol: 0.05 },
          { label: '1:1 (quadrato)', ratio: 1, tol: 0.05 },
          { label: '1.91:1 (orizzontale)', ratio: 1.91, tol: 0.08 },
        ],
        CAROUSEL: [
          { label: '1:1 (quadrato)', ratio: 1, tol: 0.05 },
          { label: '4:5 (verticale)', ratio: 0.8, tol: 0.05 },
        ],
        REEL:  [{ label: '9:16 (verticale)', ratio: 9/16, tol: 0.04 }],
        STORY: [{ label: '9:16 (verticale)', ratio: 9/16, tol: 0.04 }],
      }

      const accepted = rules[postType] || rules.PHOTO
      const best = accepted.reduce((prev, curr) => Math.abs(curr.ratio - ratio) < Math.abs(prev.ratio - ratio) ? curr : prev)
      const isValid = Math.abs(ratio - best.ratio) <= best.tol

      if (isValid) {
        setOk(`✓ Formato corretto: ${best.label} (${w}×${h}px)`)
        setWarning(null)
      } else {
        setWarning(`⚠️ Rapporto ${(ratio).toFixed(2)}:1 — Instagram suggerisce ${best.label}. Ritagliare prima di pubblicare.`)
        setOk(null)
      }
    }
    img.src = mediaUrl
  }, [mediaUrl, postType])

  if (!warning && !ok) return null

  return (
    <div style={{
      padding: '6px 10px', borderRadius: '7px', fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.4,
      background: warning ? 'rgba(251,191,36,0.1)' : 'rgba(52,211,153,0.08)',
      border: `1px solid ${warning ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.25)'}`,
      color: warning ? '#92400e' : '#065f46',
    }}>
      {warning || ok}
    </div>
  )
}
