"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Video, Trash2, Check, FolderOpen, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getAuthHeader } from '@/hooks/use-auth-token'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface UploadedAsset {
  filename: string
  url: string
  size: number
  mimeType: string
  createdAt: string
}

interface MediaUploaderProps {
  value: string[]
  onChange: (urls: string[]) => void
  multiple?: boolean
  label?: string
}

function isVideo(url: string, videoBlobUrls?: Set<string>) {
  if (videoBlobUrls?.has(url)) return true
  return /\.(mp4|webm|mov)$/i.test(url)
}

function resolveUrl(url: string) {
  return url.startsWith('/') ? `${API_URL}${url}` : url
}

// ── Thumbnail of a selected media ──────────────────────────────────────────────
function MediaThumb({ url, onRemove, videoBlobUrls }: {
  url: string; onRemove: () => void; videoBlobUrls: Set<string>
}) {
  const [showAsVideo, setShowAsVideo] = useState(() => isVideo(url, videoBlobUrls))
  const fullUrl = resolveUrl(url)

  return (
    <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(167,139,250,0.3)' }}>
      {showAsVideo
        ? <video src={fullUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
        // TODO: usare next/image quando URL è da dominio noto (API_URL arbitrario + onError non compatibile con fill in next/image)
        : <img src={fullUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setShowAsVideo(true)} />
      }
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        style={{ position: 'absolute', top: '3px', right: '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={11} color="#fff" />
      </button>
    </div>
  )
}

// ── Asset card in the archive modal ────────────────────────────────────────────
function AssetCard({ asset, selected, onSelect, onDelete }: {
  asset: UploadedAsset; selected: boolean
  onSelect: () => void; onDelete: () => void
}) {
  const fullUrl = resolveUrl(asset.url)
  const vid = asset.mimeType === 'video'
  const [previewFailed, setPreviewFailed] = useState(false)

  return (
    <div
      onClick={onSelect}
      style={{
        position: 'relative', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
        border: `2px solid ${selected ? '#a78bfa' : 'rgba(0,0,0,0.06)'}`,
        background: selected ? 'rgba(167,139,250,0.06)' : '#fff',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? '0 0 0 3px rgba(167,139,250,0.2)' : 'none',
      }}
    >
      {/* Preview area — absolute fill */}
      <div style={{ width: '100%', aspectRatio: '1', background: '#f0f0f0', position: 'relative', overflow: 'hidden' }}>
        {vid ? (
          <>
            <video src={fullUrl}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              muted playsInline />
            <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.55)', borderRadius: '4px', padding: '2px 5px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Video size={10} color="#fff" />
              <span style={{ fontSize: '0.58rem', color: '#fff', lineHeight: 1 }}>VIDEO</span>
            </div>
          </>
        ) : !previewFailed ? (
          // TODO: usare next/image quando URL è da dominio noto (API_URL arbitrario + onError non compatibile con fill in next/image)
          <img src={fullUrl} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          /* Fallback quando il browser non riesce a caricare l'immagine */
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <ImageIcon size={28} color="#ccc" />
            <span style={{ fontSize: '0.6rem', color: '#bbb' }}>No preview</span>
          </div>
        )}
      </div>

      {/* Filename */}
      <div style={{ padding: '4px 6px', fontSize: '0.65rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {asset.filename.replace(/^\d+-[a-f0-9]+-/, '')}
      </div>

      {/* Selected badge */}
      {selected && (
        <div style={{ position: 'absolute', top: '5px', left: '5px', width: '20px', height: '20px', borderRadius: '50%', background: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={12} color="#fff" />
        </div>
      )}

      {/* Delete button — visible on hover via inline handlers */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={{ position: 'absolute', top: '5px', right: '5px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0' }}
      >
        <Trash2 size={11} color="#fff" />
      </button>
    </div>
  )
}

// ── Archive Modal ──────────────────────────────────────────────────────────────
function ArchiveModal({ selectedUrls, onConfirm, onClose, multiple }: {
  selectedUrls: string[]; onConfirm: (urls: string[]) => void; onClose: () => void; multiple: boolean
}) {
  const { toast } = useToast()
  const [assets, setAssets] = useState<UploadedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<string[]>(selectedUrls)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/assets`, {
        headers: { ...getAuthHeader() }
      })
      if (res.ok) setAssets(await res.json())
    } catch (error) {
      console.error('[MediaUploader] request failed:', error)
      toast({ title: 'Errore', description: 'Richiesta non completata', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const uploaded: string[] = []
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: { ...getAuthHeader() },
          body: form,
        })
        if (res.ok) {
          const data = await res.json()
          uploaded.push(data.url)
        }
      } catch (error) {
        console.error('[MediaUploader] request failed:', error)
        toast({ title: 'Errore', description: 'Richiesta non completata', variant: 'destructive' })
      }
    }
    setUploading(false)
    await fetchAssets()
    if (multiple) setPicked(prev => [...prev, ...uploaded])
    else setPicked(uploaded.slice(0, 1))
  }

  const handleDelete = async (filename: string) => {
    await fetch(`${API_URL}/api/assets/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    })
    setPicked(prev => prev.filter(u => !u.includes(filename)))
    await fetchAssets()
  }

  const togglePick = (url: string) => {
    if (multiple) {
      setPicked(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url])
    } else {
      setPicked(prev => prev.includes(url) ? [] : [url])
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '90vw', maxWidth: '800px', maxHeight: '85vh', borderRadius: '20px', background: 'rgba(255,255,255,0.97)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 80px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '2px' }}>📁 Archivio Media</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {multiple ? 'Seleziona più file per il carosello' : 'Seleziona un file'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '10px', border: '1.5px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}
            >
              <Upload size={14} /> {uploading ? 'Caricamento...' : 'Carica dal PC'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Caricamento archivio...</div>
          ) : assets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
              <FolderOpen size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '0.9rem' }}>L&apos;archivio è vuoto.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Carica il tuo primo file con il bottone in alto.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {assets.map(a => (
                <AssetCard
                  key={a.filename}
                  asset={a}
                  selected={picked.includes(a.url)}
                  onSelect={() => togglePick(a.url)}
                  onDelete={() => handleDelete(a.filename)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {picked.length > 0 ? `${picked.length} file selezionat${picked.length === 1 ? 'o' : 'i'}` : 'Nessuna selezione'}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
            >
              Annulla
            </button>
            <button
              onClick={() => onConfirm(picked)}
              disabled={picked.length === 0}
              className="btn-gorgeous"
              style={{ padding: '8px 20px', fontSize: '0.85rem', opacity: picked.length === 0 ? 0.4 : 1 }}
            >
              Conferma selezione
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileRef} type="file" style={{ display: 'none' }}
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        multiple={multiple}
        onChange={e => handleUpload(e.target.files)}
      />
    </div>
  )
}

// ── MAIN MediaUploader ─────────────────────────────────────────────────────────
export default function MediaUploader({ value, onChange, multiple = false, label }: MediaUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [videoBlobUrls, setVideoBlobUrls] = useState<Set<string>>(new Set())
  const dropRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (files: File[]) => {
    setUploading(true)

    // 1. Instant local preview via blob URLs
    const localUrls = files.map(f => URL.createObjectURL(f))

    // Track which blob URLs are videos
    const newVideoBlobs = new Set<string>()
    files.forEach((f, i) => {
      if (f.type.startsWith('video/')) newVideoBlobs.add(localUrls[i])
    })
    setVideoBlobUrls(prev => new Set([...Array.from(prev), ...Array.from(newVideoBlobs)]))

    if (multiple) onChange([...value, ...localUrls])
    else onChange(localUrls.slice(0, 1))

    // 2. Upload to backend
    const uploadedUrls: string[] = []
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      try {
        const res = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: { ...getAuthHeader() },
          body: form,
        })
        if (res.ok) {
          const data = await res.json()
          uploadedUrls.push(data.url)
        }
      } catch {
        // Keep local blob URL as fallback
      }
    }

    // 3. Replace blob URLs with permanent backend URLs
    if (uploadedUrls.length > 0) {
      if (multiple) {
        onChange([...value.filter(u => !localUrls.includes(u)), ...uploadedUrls])
      } else {
        onChange(uploadedUrls.slice(0, 1))
      }
      localUrls.forEach(u => URL.revokeObjectURL(u))
      setVideoBlobUrls(prev => {
        const next = new Set(prev)
        localUrls.forEach(u => next.delete(u))
        return next
      })
    }

    setUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) upload(files)
  }

  const removeUrl = (url: string) => onChange(value.filter(u => u !== url))

  return (
    <div>
      {label && (
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
      )}

      {/* Selected thumbnails */}
      {value.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          {value.map(url => (
            <MediaThumb key={url} url={url} videoBlobUrls={videoBlobUrls} onRemove={() => removeUrl(url)} />
          ))}
          {multiple && value.length < 10 && (
            <div
              onClick={() => fileRef.current?.click()}
              style={{ width: '80px', height: '80px', borderRadius: '10px', border: '2px dashed rgba(167,139,250,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#a78bfa', background: 'rgba(167,139,250,0.04)' }}
            >
              <Plus size={20} />
            </div>
          )}
        </div>
      )}

      {/* Drop zone — shown when no file selected (or always for carousel) */}
      {(value.length === 0 || multiple) && (
        <div
          ref={dropRef}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#a78bfa' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: '12px', padding: '1.25rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
            background: dragOver ? 'rgba(167,139,250,0.06)' : 'rgba(0,0,0,0.02)',
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'all 0.15s', textAlign: 'center', minHeight: value.length > 0 ? 'auto' : '100px',
          }}
        >
          {uploading ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>⏳ Caricamento in corso...</div>
          ) : (
            <>
              <Upload size={22} color={dragOver ? '#a78bfa' : '#bbb'} />
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: dragOver ? '#a78bfa' : 'var(--text-secondary)' }}>
                Trascina qui o <span style={{ color: '#a78bfa', textDecoration: 'underline' }}>clicca per caricare</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>JPG, PNG, GIF, WEBP, MP4 · max 50MB</div>
            </>
          )}
        </div>
      )}

      {/* Open archive */}
      <button
        type="button"
        onClick={() => setShowArchive(true)}
        style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.5rem', padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', transition: 'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <FolderOpen size={13} /> Scegli dall&apos;archivio
      </button>

      {/* Hidden file input */}
      <input
        ref={fileRef} type="file" style={{ display: 'none' }}
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        multiple={multiple}
        onChange={e => { if (e.target.files) upload(Array.from(e.target.files)) }}
      />

      {/* Archive modal */}
      {showArchive && (
        <ArchiveModal
          selectedUrls={value}
          multiple={multiple}
          onClose={() => setShowArchive(false)}
          onConfirm={urls => { onChange(urls); setShowArchive(false) }}
        />
      )}
    </div>
  )
}
