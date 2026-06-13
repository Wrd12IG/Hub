"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, Plus, ChevronLeft, ChevronRight, Instagram, Facebook, 
  Linkedin, Music, Clock, X, Trash2, ExternalLink, RefreshCw, 
  AlertCircle, Send, Image as ImageIcon, Play, Link as LinkIcon, 
  FileText, LayoutGrid, Video, Building2, Smile, MapPin, Hash,
  AlignLeft, ChevronDown, Monitor, Smartphone, Eye, Sparkles, Calendar,
  Youtube, FileImage, Globe, Tag, Lock, BookOpen, Film, Heart, MessageCircle, Bookmark, ThumbsUp, Share2
} from 'lucide-react'
import MediaUploader from '@/components/MediaUploader'
import { InstagramGridPreview, HashtagManager, AspectRatioWarning } from '@/components/InstagramTools'
import { LinkedinDwellTimeWarning, LinkedinSeeMorePreview, LinkedinMentionLookup } from '@/components/LinkedinTools'
import { YoutubeTitleOptimizer, YoutubeAutoChapters, YoutubeFormatWarning } from '@/components/YoutubeTools'
import { TiktokKeywordSuggestions, TiktokAntiShadowbanCheck, TiktokMusicWarning } from '@/components/TiktokTools'
import { GbpLocalKeywordSuggestor, GbpHealthWidgets, GbpStoreHoursQuickEditor } from '@/components/GoogleBusinessTools'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

type Platform   = 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'GOOGLE_BUSINESS'
type PostType   = 'PHOTO' | 'CAROUSEL' | 'VIDEO' | 'REEL' | 'STORY' | 'LINK' | 'TEXT' | 'DOCUMENT'
type PostStatus = 'DRAFT' | 'READY' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED'

interface OrganicPost {
  id: string; title: string; caption: string | null; content: string | null
  platform: Platform; platforms: Platform[]; postType: PostType
  status: PostStatus; publishAt: string | null
  mediaUrls: string[]; hashtags: string[]
  metaPostId: string | null; metaPostUrl: string | null
  publishError: string | null; externalSource: string | null; importedAt: string | null
  metadata?: Record<string, any> | null
  coverUrl?: string | null
}

const PLATFORM_CONFIG: Record<Platform, { icon: React.FC<any>; color: string; bg: string; label: string; charLimit: number }> = {
  INSTAGRAM:       { icon: Instagram,  color: '#e1306c', bg: 'rgba(225,48,108,0.12)',  label: 'Instagram',       charLimit: 2200 },
  FACEBOOK:        { icon: Facebook,   color: '#1877f2', bg: 'rgba(24,119,242,0.12)', label: 'Facebook',        charLimit: 63206 },
  LINKEDIN:        { icon: Linkedin,   color: '#0a66c2', bg: 'rgba(10,102,194,0.12)', label: 'LinkedIn',        charLimit: 3000 },
  TIKTOK:          { icon: Music,      color: '#69c9d0', bg: 'rgba(105,201,208,0.12)',label: 'TikTok',          charLimit: 2200 },
  YOUTUBE:         { icon: Youtube,    color: '#ff0000', bg: 'rgba(255,0,0,0.09)',     label: 'YouTube',         charLimit: 5000 },
  GOOGLE_BUSINESS: { icon: Building2,  color: '#34a853', bg: 'rgba(52,168,83,0.12)',  label: 'Google Business', charLimit: 1500 },
}

// Matrice di compatibilità piattaforma × tipo contenuto
const PLATFORM_POST_TYPES: Record<Platform, PostType[]> = {
  INSTAGRAM:       ['PHOTO', 'CAROUSEL', 'VIDEO', 'REEL', 'STORY', 'TEXT'],
  FACEBOOK:        ['PHOTO', 'CAROUSEL', 'VIDEO', 'REEL', 'STORY', 'LINK', 'TEXT'],
  LINKEDIN:        ['PHOTO', 'CAROUSEL', 'VIDEO', 'LINK', 'TEXT', 'DOCUMENT'],
  TIKTOK:          ['VIDEO', 'REEL'],
  YOUTUBE:         ['VIDEO', 'REEL'],
  GOOGLE_BUSINESS: ['PHOTO', 'VIDEO', 'LINK', 'TEXT'],
}
// Torna i tipi compatibili con TUTTE le piattaforme selezionate
function getCompatibleTypes(platforms: Platform[]): PostType[] {
  if (!platforms.length) return Object.keys(PLATFORM_POST_TYPES.INSTAGRAM) as PostType[]
  return platforms.reduce((acc, p) => {
    const allowed = PLATFORM_POST_TYPES[p]
    return acc.filter(t => allowed.includes(t))
  }, Object.values(PLATFORM_POST_TYPES).flat().filter((v, i, a) => a.indexOf(v) === i) as PostType[])
}

// Aspect ratio copertina per link post (per mostrare hint)
const LINK_COVER_RATIO: Partial<Record<Platform, { ratio: string; hint: string }>> = {
  FACEBOOK:        { ratio: '1.91/1', hint: '1200×630px – ratio 1.91:1' },
  LINKEDIN:        { ratio: '1.91/1', hint: '1200×627px – ratio 1.91:1' },
  GOOGLE_BUSINESS: { ratio: '4/3',   hint: '1200×900px – ratio 4:3' },
}

const POST_TYPE_CONFIG: Record<PostType, { icon: React.FC<any>; label: string }> = {
  PHOTO:    { icon: ImageIcon,  label: 'Foto'       },
  CAROUSEL: { icon: LayoutGrid, label: 'Carosello'  },
  VIDEO:    { icon: Video,      label: 'Video'      },
  REEL:     { icon: Play,       label: 'Reel/Short' },
  STORY:    { icon: Film,       label: 'Story'      },
  LINK:     { icon: LinkIcon,   label: 'Link'       },
  TEXT:     { icon: FileText,   label: 'Testo'      },
  DOCUMENT: { icon: FileImage,  label: 'Documento'  },
}
const STATUS_CONFIG: Record<PostStatus, { color: string; bg: string; label: string }> = {
  DRAFT:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  label: 'Bozza'          },
  READY:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'Pronto'         },
  SCHEDULED:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', label: 'Schedulato'     },
  PUBLISHING: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   label: 'Pubblicando...' },
  PUBLISHED:  { color: '#34d399', bg: 'rgba(52,211,153,0.1)',   label: '✓ Pubblicato'  },
  FAILED:     { color: '#f87171', bg: 'rgba(248,113,113,0.1)',  label: '✗ Fallito'     },
}
const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
const DAY_NAMES   = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab']
function getDaysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate() }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay() }

// ── POST CHIP (calendar cell) ──────────────────────────────────────────────────
function PostChip({ post, onClick }: { post: OrganicPost; onClick: (e: React.MouseEvent) => void }) {
  const pps = post.platforms?.length ? post.platforms : [post.platform]
  const pc = PLATFORM_CONFIG[pps[0]]
  const tc = POST_TYPE_CONFIG[post.postType]
  const TypeIcon = tc.icon
  const time = post.publishAt ? new Date(post.publishAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '–'
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 6px', borderRadius: '7px',
      background: pc.bg, border: `1px solid ${pc.color}22`, cursor: 'pointer', marginBottom: '3px',
      fontSize: '0.67rem', fontWeight: 600, maxWidth: '100%', overflow: 'hidden',
    }}>
      <TypeIcon size={9} color={pc.color} style={{ flexShrink: 0 }} />
      <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>{time}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)', flex: 1 }}>{post.title}</span>
      <span style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        {pps.slice(0,3).map(p => { const ic = PLATFORM_CONFIG[p]; const Icon = ic.icon; return <Icon key={p} size={9} color={ic.color} /> })}
      </span>
    </div>
  )
}

// ── LIVE PREVIEW ──────────────────────────────────────────────────────────────
function LivePreview({ platform, caption, postType, mediaUrls, coverUrl, clientName }: {
  platform: Platform; caption: string; postType: PostType; mediaUrls: string[]; coverUrl?: string; clientName: string
}) {
  const pc = PLATFORM_CONFIG[platform]
  const Icon = pc.icon
  const hasMedia = mediaUrls.filter(Boolean).length > 0
  // URLs are already fully resolved by the caller
  const firstMedia = mediaUrls.filter(Boolean)[0]
  const isVideoPost = postType === 'VIDEO' || postType === 'REEL'
  // Detect video: check extension for backend URLs
  const firstIsVideo = firstMedia 
    ? /\.(mp4|webm|mov)$/i.test(firstMedia)
    : false
  // In preview: if video post, show cover (if set) with ▶ overlay; else show video itself
  const previewMedia = isVideoPost ? (coverUrl || firstMedia) : firstMedia
  const showPlayOverlay = isVideoPost && (coverUrl || firstMedia)

  if (platform === 'INSTAGRAM') {
    return (
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', maxWidth: '340px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>{clientName[0]?.toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#000' }}>{clientName.toLowerCase().replace(/\s/g,'_')}</div>
              <div style={{ fontSize: '10px', color: '#737373' }}>{postType === 'REEL' ? '♻️ Reel' : postType === 'STORY' ? '📱 Storia' : 'Post'}</div>
            </div>
          </div>
          <span style={{ fontSize: '18px', color: '#000' }}>···</span>
        </div>
        {/* Media */}
        <div style={{ width: '100%', aspectRatio: postType === 'REEL' ? '9/16' : '1', background: '#f0f0f0', overflow: 'hidden', position: 'relative', maxHeight: postType === 'REEL' ? '400px' : undefined }}>
          {(hasMedia || coverUrl)
            ? <>
                {/* Media layer — fill entire container absolutely */}
                <div style={{ position: 'absolute', inset: 0 }}>
                  {(coverUrl || !firstIsVideo)
                    ? <img src={previewMedia} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <video src={firstMedia} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} autoPlay muted loop playsInline />
                  }
                </div>
                {/* ▶ Play overlay for video/reel */}
                {showPlayOverlay && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.3)' }}>
                      <span style={{ fontSize: '18px', marginLeft: '4px' }}>▶</span>
                    </div>
                  </div>
                )}
              </>
            : <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#c7c7c7' }}>
                {postType === 'VIDEO' || postType === 'REEL' ? <Video size={36} /> : <ImageIcon size={36} />}
                <span style={{ fontSize: '11px' }}>{postType === 'REEL' ? 'Anteprima Reel' : 'Anteprima immagine'}</span>
              </div>
          }
        </div>
        {/* Actions */}
        <div style={{ padding: '8px 12px 4px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <Heart size={24} style={{ cursor: 'pointer', color: '#111' }} strokeWidth={1.8} />
          <MessageCircle size={24} style={{ cursor: 'pointer', transform: 'scaleX(-1)', color: '#111' }} strokeWidth={1.8} />
          <Send size={24} style={{ cursor: 'pointer', transform: 'rotate(15deg) translateY(-2px)', color: '#111' }} strokeWidth={1.8} />
          <Bookmark size={24} style={{ marginLeft: 'auto', cursor: 'pointer', color: '#111' }} strokeWidth={1.8} />
        </div>
        {/* Caption */}
        <div style={{ padding: '4px 12px 12px', fontSize: '12px', color: '#000', lineHeight: 1.4 }}>
          <strong>{clientName.toLowerCase().replace(/\s/g,'_')}</strong>{' '}
          <span style={{ color: '#262626' }}>{caption ? caption.slice(0, 120) + (caption.length > 120 ? '...' : '') : <span style={{ color: '#c7c7c7' }}>La tua caption apparirà qui...</span>}</span>
        </div>
      </div>
    )
  }

  if (platform === 'FACEBOOK') {
    return (
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', maxWidth: '340px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontFamily: 'Helvetica Neue,Helvetica,Arial,sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{clientName[0]?.toUpperCase()}</span>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#050505' }}>{clientName}</div>
              <div style={{ fontSize: '11px', color: '#65676b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · 🌐
              </div>
            </div>
          </div>
          <span style={{ fontSize: '20px', color: '#65676b' }}>···</span>
        </div>
        {caption && <div style={{ padding: '0 12px 10px', fontSize: '13px', color: '#050505', lineHeight: 1.5 }}>{caption.slice(0, 150)}{caption.length > 150 ? '...' : ''}</div>}
        {(hasMedia || coverUrl)
          ? <div style={{ background: '#f0f0f0', aspectRatio: '1.91', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {(coverUrl || !firstIsVideo)
                ? <img src={coverUrl || previewMedia} alt="" style={{ width: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                : <video src={firstMedia} style={{ width: '100%', objectFit: 'cover' }} autoPlay muted loop playsInline />}
              {showPlayOverlay && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.15)' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '14px', marginLeft: '3px' }}>▶</span>
                  </div>
                </div>
              )}
            </div>
          : <div style={{ background: '#f0f2f5', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bec3c9' }}><ImageIcon size={32} /></div>
        }
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e4e6eb', display: 'flex', gap: '4px' }}>
          {[
            { Icon: ThumbsUp, label: 'Mi piace' },
            { Icon: MessageCircle, label: 'Commenta' },
            { Icon: Share2, label: 'Condividi' }
          ].map(({ Icon, label }) => (
            <button key={label} style={{ flex: 1, background: 'none', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#65676b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Icon size={18} strokeWidth={1.5} /> {label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (platform === 'LINKEDIN') {
    return (
      <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', maxWidth: '340px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontFamily: '-apple-system,sans-serif', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', gap: '10px', padding: '12px 12px 8px', alignItems: 'flex-start' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700 }}>{clientName[0]?.toUpperCase()}</span>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#000' }}>{clientName}</div>
            <div style={{ fontSize: '11px', color: '#666' }}>Pagina aziendale</div>
          </div>
        </div>
        {caption && <div style={{ padding: '0 12px 10px', fontSize: '13px', color: '#000', lineHeight: 1.5 }}>{caption.slice(0, 200)}{caption.length > 200 ? '...' : ''}</div>}
        {hasMedia && <div style={{ background: '#f3f2ef', aspectRatio: '1.91', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img src={firstMedia} alt="" style={{ width: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
        </div>}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '16px' }}>
          {[
            { Icon: ThumbsUp, label: 'Consiglia' },
            { Icon: MessageCircle, label: 'Commenta' },
            { Icon: Share2, label: 'Condividi' }
          ].map(({ Icon, label }) => (
            <span key={label} style={{ fontSize: '12px', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <Icon size={16} strokeWidth={1.5} color="#555" /> {label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Fallback (TikTok, Google Business)
  return (
    <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', maxWidth: '340px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: '20px', textAlign: 'center' }}>
      <Icon size={40} color={pc.color} />
      <div style={{ marginTop: '16px', fontWeight: 700, fontSize: '14px', color: '#000' }}>{clientName}</div>
      {caption && <p style={{ fontSize: '12px', color: '#444', lineHeight: 1.5, marginTop: '8px' }}>{caption.slice(0,200)}</p>}
      {!caption && <p style={{ fontSize: '12px', color: '#bbb', marginTop: '8px' }}>Inizia a scrivere per vedere l'anteprima...</p>}
    </div>
  )
}

// ── POST CREATION MODAL (Metricool-style split panel) ─────────────────────────
function PostModal({
  post, defaultDate, clientId, clientName, onClose, onSave, onDelete
}: {
  post: OrganicPost | null; defaultDate: string | null; clientId: string; clientName: string
  onClose: () => void; onSave: () => void; onDelete?: () => void
}) {
  const isNew = !post
  const [title,     setTitle]     = useState(post?.title || '')
  const [caption,   setCaption]   = useState(post?.caption || '')
  const [platforms, setPlatforms] = useState<Platform[]>(
    post?.platforms?.length ? post.platforms : post?.platform ? [post.platform] : ['INSTAGRAM']
  )
  const [postType,  setPostType]  = useState<PostType>(post?.postType || 'PHOTO')
  const [status,    setStatus]    = useState<PostStatus>(post?.status || 'DRAFT')
  const [publishAt, setPublishAt] = useState(
    post?.publishAt ? new Date(post.publishAt).toISOString().slice(0,16)
    : defaultDate ? `${defaultDate}T10:00` : new Date().toISOString().slice(0,16)
  )
  const [mediaUrlsList, setMediaUrlsList] = useState<string[]>(
    // For VIDEO/REEL: mediaUrls[0] = cover, mediaUrls[1+] = video URLs
    (post?.postType === 'VIDEO' || post?.postType === 'REEL')
      ? post?.mediaUrls?.slice(1) || []
      : post?.mediaUrls || []
  )
  const [coverUrl, setCoverUrl] = useState<string[]>(
    (post?.postType === 'VIDEO' || post?.postType === 'REEL')
      ? (post?.mediaUrls?.[0] ? [post.mediaUrls[0]] : [])
      : []
  )
  const [mediaUrls, setMediaUrls] = useState((post?.mediaUrls || []).join('\n'))

  // Keep mediaUrls string in sync with list (for buildPayload)
  const handleMediaChange = (urls: string[]) => {
    setMediaUrlsList(urls)
    setMediaUrls(urls.join('\n'))
  }
  const [hashtags,  setHashtags]    = useState((post?.hashtags || []).join(' '))
  const [linkUrl,   setLinkUrl]     = useState('')

  // ── YouTube-specific metadata ──────────────────────────────────────
  const meta = (post?.metadata as any) || {}
  const [ytTitle,     setYtTitle]     = useState<string>(meta.youtubeTitle || '')
  const [ytPrivacy,   setYtPrivacy]   = useState<'PUBLIC'|'UNLISTED'|'PRIVATE'>(meta.youtubePrivacy || 'UNLISTED')
  const [ytCategory,  setYtCategory]  = useState<string>(meta.youtubeCategory || '')
  const [ytTags,      setYtTags]      = useState<string>(meta.youtubeTags?.join(', ') || '')
  const [ytIsShort,   setYtIsShort]   = useState<boolean>(meta.youtubeIsShort || false)
  const [ytKids,      setYtKids]      = useState<boolean>(meta.youtubeMadeForKids || false)
  const [ytLicense,   setYtLicense]   = useState<'youtube'|'creativeCommon'>(meta.youtubeLicense || 'youtube')
  const [ytIsSynthetic,setYtIsSynthetic] = useState<boolean>(meta.youtubeIsSynthetic || false)

  // ── TikTok-specific metadata ──────────────────────────────────────────
  const [tkPrivacy, setTkPrivacy] = useState<'PUBLIC_TO_EVERYONE'|'MUTUAL_FOLLOW_FRIENDS'|'SELF_ONLY'>(meta.tiktokPrivacy || 'PUBLIC_TO_EVERYONE')
  const [tkDisableComment, setTkDisableComment] = useState<boolean>(meta.tiktokDisableComment || false)
  const [tkDisableDuet, setTkDisableDuet] = useState<boolean>(meta.tiktokDisableDuet || false)
  const [tkDisableStitch, setTkDisableStitch] = useState<boolean>(meta.tiktokDisableStitch || false)
  const [tkAigc, setTkAigc] = useState<boolean>(meta.tiktokAigc || false)
  const [tkDraftMode, setTkDraftMode] = useState<boolean>(meta.tiktokDraftMode || false)

  // ── Google Business-specific metadata ────────────────────────────────
  const [gbpTopicType, setGbpTopicType] = useState<'STANDARD' | 'EVENT' | 'OFFER'>(meta.gbpTopicType || 'STANDARD')
  const [gbpActionType, setGbpActionType] = useState<'ACTION_TYPE_UNSPECIFIED' | 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL'>(meta.gbpActionType || 'ACTION_TYPE_UNSPECIFIED')
  const [gbpStartDate, setGbpStartDate] = useState<string>(meta.gbpStartDate || '')
  const [gbpStartTime, setGbpStartTime] = useState<string>(meta.gbpStartTime || '')
  const [gbpEndDate, setGbpEndDate] = useState<string>(meta.gbpEndDate || '')
  const [gbpEndTime, setGbpEndTime] = useState<string>(meta.gbpEndTime || '')
  const [gbpCouponCode, setGbpCouponCode] = useState<string>(meta.gbpCouponCode || '')
  const [gbpTermsConditions, setGbpTermsConditions] = useState<string>(meta.gbpTermsConditions || '')

  // ── LinkedIn DOCUMENT (PDF) ─────────────────────────────────────────
  const [documentTitle, setDocumentTitle] = useState<string>(meta.documentTitle || '')
  const [pdfUrls,       setPdfUrls]       = useState<string[]>(
    post?.postType === 'DOCUMENT' ? (post?.mediaUrls || []) : []
  )

  const [previewPlatform, setPreviewPlatform] = useState<Platform>(platforms[0] || 'INSTAGRAM')
  const [saving, setSaving] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)

  // Keep preview in sync with first selected platform
  useEffect(() => { if (!platforms.includes(previewPlatform) && platforms.length) setPreviewPlatform(platforms[0]) }, [platforms])

  // Auto-fix postType if selected platforms don't support it
  const compatibleTypes = getCompatibleTypes(platforms)
  useEffect(() => {
    if (!compatibleTypes.includes(postType) && compatibleTypes.length > 0) {
      setPostType(compatibleTypes[0])
    }
  }, [platforms])

  const charLimit = PLATFORM_CONFIG[previewPlatform]?.charLimit || 2200
  const charCount = caption.length

  const toggle = (p: Platform) => setPlatforms(prev => prev.includes(p) ? prev.filter(x => x!==p) : [...prev, p])

  const isVideoPost     = postType === 'VIDEO' || postType === 'REEL'
  const isDocumentPost  = postType === 'DOCUMENT'
  const isLinkPost      = postType === 'LINK'
  const hasYoutube      = platforms.includes('YOUTUBE')
  const hasLinkedIn     = platforms.includes('LINKEDIN')
  const hasFacebook     = platforms.includes('FACEBOOK')
  const hasInstagram    = platforms.includes('INSTAGRAM')
  const hasTiktok       = platforms.includes('TIKTOK')
  const hasGbp          = platforms.includes('GOOGLE_BUSINESS')
  const linkCoverHint   = platforms.map(p => LINK_COVER_RATIO[p]).find(Boolean)

  // ── Facebook-specific fields ────────────────────────────────
  const [firstComment,     setFirstComment]     = useState<string>(meta.firstComment || '')
  const [locationName,     setLocationName]     = useState<string>(meta.location?.name || '')
  const [crossPostIG,      setCrossPostIG]       = useState<boolean>(meta.crossPostIG ?? false)
  const [crossPostThreads, setCrossPostThreads] = useState<boolean>(meta.crossPostThreads ?? false)

  // ── Instagram-specific fields ────────────────────────────────
  const [altText,              setAltText]              = useState<string>(meta.altText || '')
  const [collaboratorUsername, setCollaboratorUsername] = useState<string>(meta.collaboratorUsername || '')
  const [storyLinkUrl,         setStoryLinkUrl]         = useState<string>(meta.storyLinkUrl || '')
  const [shareToFeed,          setShareToFeed]          = useState<boolean>(meta.shareToFeed ?? true)

  const isStoryPost = postType === 'STORY'

  const buildPayload = () => {
    const isVideo = postType === 'VIDEO' || postType === 'REEL'
    const finalMediaUrls = isVideo
      ? [...coverUrl, ...mediaUrlsList]
      : isDocumentPost
        ? pdfUrls
        : mediaUrlsList

    const metadata: Record<string, any> = {}
    if (hasYoutube) {
      metadata.youtubeTitle        = ytTitle || title
      metadata.youtubePrivacy      = ytPrivacy
      metadata.youtubeCategory     = ytCategory || undefined
      metadata.youtubeTags         = ytTags ? ytTags.split(',').map(t => t.trim()).filter(Boolean) : []
      metadata.youtubeIsShort      = ytIsShort
      metadata.youtubeMadeForKids  = ytKids
      metadata.youtubeLicense      = ytLicense
      metadata.youtubeIsSynthetic  = ytIsSynthetic
    }
    if (hasTiktok) {
      metadata.tiktokPrivacy = tkPrivacy
      metadata.tiktokDisableComment = tkDisableComment
      metadata.tiktokDisableDuet = tkDisableDuet
      metadata.tiktokDisableStitch = tkDisableStitch
      metadata.tiktokAigc = tkAigc
      metadata.tiktokDraftMode = tkDraftMode
    }
    if (hasGbp) {
      metadata.gbpTopicType = gbpTopicType
      metadata.gbpActionType = gbpActionType
      metadata.gbpStartDate = gbpStartDate
      metadata.gbpStartTime = gbpStartTime
      metadata.gbpEndDate = gbpEndDate
      metadata.gbpEndTime = gbpEndTime
      metadata.gbpCouponCode = gbpCouponCode
      metadata.gbpTermsConditions = gbpTermsConditions
    }
    if (isDocumentPost) {
      metadata.documentTitle = documentTitle
    }
    // Multi-platform shared settings
    if (hasFacebook || hasInstagram || hasLinkedIn) {
      if (firstComment)  metadata.firstComment  = firstComment
      if (locationName)  metadata.location      = { name: locationName }
      if (crossPostIG)   metadata.crossPostIG   = true
      if (crossPostThreads) metadata.crossPostThreads = true
    }
    if (isLinkPost && coverUrl.length) {
      metadata.linkCoverUrl = coverUrl[0]
    }
    // Instagram-specific
    if (hasInstagram) {
      if (altText)              metadata.altText              = altText
      if (collaboratorUsername) metadata.collaboratorUsername = collaboratorUsername
      if (isStoryPost && storyLinkUrl) metadata.storyLinkUrl = storyLinkUrl
      if (isVideoPost) metadata.shareToFeed = shareToFeed
    }

    return {
      title: title || 'Nuovo Post',
      caption, platform: platforms[0] || 'INSTAGRAM',
      platforms, postType, status,
      publishAt: publishAt || undefined,
      hashtags: hashtags.split(/\s+/).filter(h => h.startsWith('#')),
      mediaUrls: finalMediaUrls,
      linkUrl: linkUrl || undefined,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    }
  }

  const handleSave = async () => {
    if (!platforms.length) return
    setSaving(true)
    const token = localStorage.getItem('token')
    const payload = buildPayload()
    if (isNew) {
      await fetch(`${API_URL}/api/clients/${clientId}/organic`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch(`${API_URL}/api/organic/${post!.id}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setSaving(false)
    onSave()
  }

  const handleSchedule = async () => {
    setSaving(true)
    const token = localStorage.getItem('token')
    const payload = { ...buildPayload(), status: 'SCHEDULED' as PostStatus }
    
    if (isNew) {
      // Prima crea il post, poi aggiorna lo stato
      const res = await fetch(`${API_URL}/api/clients/${clientId}/organic`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch(`${API_URL}/api/organic/${post!.id}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setSaving(false)
    onSave()
  }

  const TypeIcon = (POST_TYPE_CONFIG[postType] ?? POST_TYPE_CONFIG['PHOTO']).icon

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '90vw', maxWidth: '960px', maxHeight: '92vh',
        borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)',
        boxShadow: '0 25px 80px rgba(0,0,0,0.2)',
      }}>
        
        {/* ── TOP BAR ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
              {isNew ? 'Crea nuovo post' : 'Modifica post'}
            </span>
            {post?.externalSource && (
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontWeight: 600 }}>
                📥 Da {post.externalSource}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
            <X size={18} /> Chiudi
          </button>
        </div>

        {/* ── MAIN BODY (split) ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* LEFT — Editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            
            {/* Platform + PostType bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap', flexShrink: 0 }}>
              {/* Platform toggles */}
              {(Object.keys(PLATFORM_CONFIG) as Platform[]).map(p => {
                const cfg = PLATFORM_CONFIG[p]
                const Icon = cfg.icon
                const sel = platforms.includes(p)
                return (
                  <button key={p} title={cfg.label} onClick={() => toggle(p)}
                    style={{
                      width: '34px', height: '34px', borderRadius: '50%', border: `2px solid ${sel ? cfg.color : '#e0e0e0'}`,
                      background: sel ? cfg.bg : 'rgba(255,255,255,0.7)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}>
                    <Icon size={16} color={sel ? cfg.color : '#bbb'} />
                  </button>
                )
              })}
              
              {/* Divider */}
              <div style={{ width: '1px', height: '28px', background: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />

              {/* Post type dropdown */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowTypeMenu(m => !m)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '20px', border: '1.5px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <TypeIcon size={13} /> {(POST_TYPE_CONFIG[postType] ?? POST_TYPE_CONFIG['PHOTO']).label} <ChevronDown size={12} />
                </button>
                {showTypeMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 10, overflow: 'hidden', minWidth: '150px', border: '1px solid rgba(0,0,0,0.08)' }}>
                    {(Object.entries(POST_TYPE_CONFIG) as [PostType, any][]).map(([k, v]) => {
                      const Icon = v.icon
                      const isCompatible = compatibleTypes.includes(k)
                      return (
                        <button key={k}
                          onClick={() => { if (isCompatible) { setPostType(k); setShowTypeMenu(false) } }}
                          title={isCompatible ? '' : `Non disponibile per ${platforms.map(p => PLATFORM_CONFIG[p].label).join(', ')}`}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', width: '100%', background: postType===k ? 'rgba(167,139,250,0.1)' : 'none', border: 'none', cursor: isCompatible ? 'pointer' : 'not-allowed', fontSize: '0.82rem', fontWeight: postType===k ? 700 : 500, color: postType===k ? '#a78bfa' : isCompatible ? 'var(--text-primary)' : '#ccc', textAlign: 'left', opacity: isCompatible ? 1 : 0.45 }}
                        >
                          <Icon size={14} /> {v.label}
                          {!isCompatible && <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#e0e0e0' }}>N/D</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Title */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo interno (opzionale)..."
                  style={{ background: 'none', border: 'none', outline: 'none', fontSize: '0.82rem', color: 'var(--text-secondary)', minWidth: '80px' }} />
                {hasYoutube && (
                  <YoutubeTitleOptimizer currentTitle={title} onAply={setTitle} />
                )}
              </div>
            </div>

            {/* Caption editor */}
            <textarea
              value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="Scrivi il testo del post..."
              style={{
                flex: 1, border: 'none', outline: 'none', resize: 'none',
                background: 'transparent', fontSize: '0.925rem', lineHeight: 1.65,
                color: 'var(--text-primary)', padding: '1rem', fontFamily: 'inherit',
                minHeight: '180px',
                // Reset browser default styles (Safari/Mac adds rounded border)
                WebkitAppearance: 'none',
                appearance: 'none',
                borderRadius: 0,
                boxShadow: 'none',
              }}
            />
            {hasLinkedIn && (
              <div style={{ padding: '0 1rem 0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <LinkedinMentionLookup onSelect={(urn, name) => setCaption(c => c + ` @[${name}](${urn}) `)} />
                <LinkedinSeeMorePreview text={caption} />
                <LinkedinDwellTimeWarning text={caption} />
              </div>
            )}
            {hasGbp && (
              <div style={{ padding: '0 1rem 0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <GbpLocalKeywordSuggestor onAdd={(kw) => setCaption(c => c + ` ${kw} `)} />
              </div>
            )}
            {hasYoutube && isVideoPost && (
              <div style={{ padding: '0 1rem 0.5rem 1rem' }}>
                <YoutubeAutoChapters onApply={(chapters) => setCaption(c => c + chapters)} />
              </div>
            )}

            {/* ── CONTENT SECTION ───────────────────────────────── */}
            <div style={{ padding: '0 1rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.75rem', paddingBottom: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              {/* VIDEO / REEL */}
              {isVideoPost && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <MediaUploader value={mediaUrlsList} onChange={handleMediaChange} multiple={false}
                      label={postType === 'REEL' ? `🎬 ${platforms.includes('YOUTUBE') ? 'YouTube Short (verticale)' : 'Reel'}` : '🎬 Video'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <MediaUploader value={coverUrl} onChange={setCoverUrl} multiple={false} label="🖼️ Copertina (thumbnail)" />
                  </div>
                </div>
              )}

              {/* PHOTO / CAROUSEL */}
              {(postType === 'PHOTO' || postType === 'CAROUSEL') && (
                <MediaUploader value={mediaUrlsList} onChange={handleMediaChange}
                  multiple={postType === 'CAROUSEL'}
                  label={postType === 'CAROUSEL' ? '🖼️ Slide carosello (max 10)' : '🖼️ Immagine'} />
              )}

              {/* DOCUMENT (PDF — LinkedIn) */}
              {isDocumentPost && (
                <>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📄 Titolo documento (LinkedIn)</div>
                    <input value={documentTitle} onChange={e => setDocumentTitle(e.target.value)}
                      placeholder="Es: Guida al Social Media Marketing 2025"
                      style={{ width: '100%', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>
                  <MediaUploader value={pdfUrls} onChange={setPdfUrls} multiple={false} label="📎 Carica PDF" />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: 'rgba(10,102,194,0.06)', borderRadius: '8px', border: '1px solid rgba(10,102,194,0.15)' }}>
                    <Linkedin size={14} color="#0a66c2" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <p style={{ fontSize: '0.72rem', color: '#0a66c2', margin: 0, lineHeight: 1.4 }}>
                      Il PDF verrà pubblicato come <strong>documento interattivo</strong> su LinkedIn con sfoglio slide. Max 100 pagine, max 100MB.
                    </p>
                  </div>
                </>
              )}

              {/* TIKTOK UI PANELS */}
              {hasTiktok && isVideoPost && (
                <TiktokAntiShadowbanCheck videoUrls={mediaUrlsList} />
              )}


              {/* LINK */}
              {isLinkPost && (
                <>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔗 URL da condividere</div>
                    <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://example.com"
                      style={{ width: '100%', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>
                  {/* Cover per link — obbligatoria per Facebook/LinkedIn/Google */}
                  <div>
                    <MediaUploader value={coverUrl} onChange={setCoverUrl} multiple={false}
                      label={`🖼️ Copertina link${linkCoverHint ? ` — ${linkCoverHint.hint}` : ''}`} />
                    {linkCoverHint && (
                      <div style={{ marginTop: '4px', fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Aspect ratio consigliato:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{linkCoverHint.hint}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TEXT — no media */}
              {postType === 'TEXT' && (
                <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  Post di solo testo — nessun media richiesto
                </div>
              )}

              {/* STORY */}
              {isStoryPost && (
                <>
                  <MediaUploader value={mediaUrlsList} onChange={handleMediaChange} multiple={false}
                    label="📖 Media Story (9:16 — 1080×1920px)" />
                  {/* Story link sticker */}
                  {hasInstagram && (
                    <div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔗 Link Sticker (ex Swipe Up)</div>
                      <input value={storyLinkUrl} onChange={e => setStoryLinkUrl(e.target.value)}
                        placeholder="https://example.com"
                        style={{ width: '100%', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    </div>
                  )}
                  <div style={{ padding: '6px 10px', background: 'rgba(225,48,108,0.05)', borderRadius: '8px', fontSize: '0.7rem', color: '#9d174d' }}>
                    ⏱ Le Stories scadono automaticamente dopo <strong>24 ore</strong>. Formato obbligatorio: 9:16 verticale.
                  </div>
                </>
              )}

              {/* Aspect Ratio Warning (Instagram) */}
              {hasInstagram && mediaUrlsList[0] && !isStoryPost && !isVideoPost && (
                <AspectRatioWarning mediaUrl={mediaUrlsList[0]} postType={postType} />
              )}

              {/* Hashtag Manager (Instagram/Facebook) */}
              {(hasInstagram || hasFacebook) && (
                <HashtagManager
                  clientId={clientId}
                  currentHashtags={hashtags}
                  onApply={setHashtags}
                />
              )}

              {/* ── INSTAGRAM EXTRA FIELDS ───────────────────────────── */}
              {hasInstagram && !isStoryPost && (
                <div style={{ background: 'rgba(225,48,108,0.04)', border: '1px solid rgba(225,48,108,0.12)', borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <Instagram size={14} color="#e1306c" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#e1306c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instagram Settings</span>
                  </div>

                  {/* Alt Text */}
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '3px' }}>
                      🔤 Alt Text — accessibilità + SEO Instagram
                    </label>
                    <input value={altText} onChange={e => setAltText(e.target.value)}
                      placeholder="Descrivi l'immagine per non vedenti e per l'algoritmo..."
                      style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>

                  {/* Collab */}
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                      <BookOpen size={10} /> Collaboratore (Collab Post)
                    </label>
                    <input value={collaboratorUsername} onChange={e => setCollaboratorUsername(e.target.value)}
                      placeholder="@username_collaboratore"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>

                  {/* Reel: Share to feed toggle */}
                  {(postType === 'REEL') && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={shareToFeed} onChange={e => setShareToFeed(e.target.checked)} />
                      📱 Mostra anche nel Feed (oltre ai Reels)
                    </label>
                  )}
                </div>
              )}

              {/* ── YOUTUBE EXTRA FIELDS ─────────────────────────────── */}
              {hasYoutube && isVideoPost && (
                <div style={{ background: 'rgba(255,0,0,0.04)', border: '1px solid rgba(255,0,0,0.12)', borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <Youtube size={14} color="#ff0000" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff0000', textTransform: 'uppercase', letterSpacing: '0.05em' }}>YouTube Settings</span>
                  </div>
                  {/* Title */}
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '3px' }}>Titolo video (max 100 caratteri)</label>
                    <input value={ytTitle} onChange={e => setYtTitle(e.target.value.slice(0,100))}
                      placeholder={title || 'Titolo del video su YouTube...'} maxLength={100}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    <div style={{ textAlign: 'right', fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{ytTitle.length}/100</div>
                  </div>
                  {/* Privacy + Category */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                        <Lock size={10} /> Privacy
                      </label>
                      <select value={ytPrivacy} onChange={e => setYtPrivacy(e.target.value as any)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="PUBLIC">Pubblico</option>
                        <option value="UNLISTED">Non in elenco</option>
                        <option value="PRIVATE">Privato</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                        <Tag size={10} /> Categoria
                      </label>
                      <select value={ytCategory} onChange={e => setYtCategory(e.target.value)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="">Seleziona...</option>
                        <option value="22">Persone e Blog</option>
                        <option value="28">Scienza e Tecnologia</option>
                        <option value="17">Sport</option>
                        <option value="10">Musica</option>
                        <option value="24">Intrattenimento</option>
                        <option value="27">Istruzione</option>
                        <option value="25">Notizie e Politica</option>
                        <option value="26">Tutorial</option>
                        <option value="19">Viaggi e Natura</option>
                        <option value="20">Giochi</option>
                      </select>
                    </div>
                  </div>
                  {/* Tags */}
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                      <Hash size={10} /> Tag (separati da virgola)
                    </label>
                    <input value={ytTags} onChange={e => setYtTags(e.target.value)}
                      placeholder="social media, marketing, tutorial..."
                      style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>
                  {/* Toggles + Advanced */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={ytIsShort} onChange={e => setYtIsShort(e.target.checked)} />
                      Short (&lt;60s, verticale)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={ytKids} onChange={e => setYtKids(e.target.checked)} />
                      Contenuto per bambini (COPPA)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={ytIsSynthetic} onChange={e => setYtIsSynthetic(e.target.checked)} />
                      Contenuto Modificato (AI)
                    </label>
                  </div>
                  <div>
                     <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                       Licenza
                     </label>
                     <select value={ytLicense} onChange={e => setYtLicense(e.target.value as any)}
                       style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
                       <option value="youtube">Licenza YouTube standard</option>
                       <option value="creativeCommon">Creative Commons (CC BY)</option>
                     </select>
                  </div>
                  <YoutubeFormatWarning isShort={ytIsShort} />
                </div>
              )}


              {/* ── TIKTOK EXTRA FIELDS ─────────────── */}
              {hasTiktok && (
                <div style={{ background: 'rgba(105,201,208,0.04)', border: '1px solid rgba(105,201,208,0.12)', borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <Music size={14} color="#69c9d0" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#69c9d0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TikTok Settings</span>
                  </div>

                  {/* Workflow Draft vs Direct */}
                  <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      <input type="checkbox" checked={tkDraftMode} onChange={e => setTkDraftMode(e.target.checked)} />
                      Invia a InboX TikTok (Bozza) invece che pubblicazione diretta
                    </label>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginLeft: '22px', marginTop: '2px' }}>
                      Manda il video al box "Da pubblicare" dell'account TikTok. Riceverai una notifica push per aggiungere filtri, audio trend e sticker direttamente dallo smartphone prima di inviarlo.
                    </div>
                  </div>

                  <TiktokMusicWarning />

                  {/* Privacy */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '4px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '3px' }}>Privacy</label>
                      <select value={tkPrivacy} onChange={e => setTkPrivacy(e.target.value as any)}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="PUBLIC_TO_EVERYONE">Pubblico</option>
                        <option value="MUTUAL_FOLLOW_FRIENDS">Amici</option>
                        <option value="SELF_ONLY">Privato (Solo Io)</option>
                      </select>
                    </div>
                  </div>

                  {/* Toggles + AIGC */}
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '2px', background: 'rgba(0,0,0,0.02)', padding: '6px', borderRadius: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={!tkDisableComment} onChange={e => setTkDisableComment(!e.target.checked)} /> Commenti
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={!tkDisableDuet} onChange={e => setTkDisableDuet(!e.target.checked)} /> Duetti
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={!tkDisableStitch} onChange={e => setTkDisableStitch(!e.target.checked)} /> Stitch
                    </label>
                    
                    <div style={{ width: '1px', background: 'rgba(0,0,0,0.1)', height: '14px', alignSelf: 'center', margin: '0 4px' }} />
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.74rem', color: '#c62828', fontWeight: 600 }}>
                      <input type="checkbox" checked={tkAigc} onChange={e => setTkAigc(e.target.checked)} /> Contenuto generato dall'AI
                    </label>
                  </div>
                </div>
              )}

              {/* ── GOOGLE BUSINESS EXTRA FIELDS ─────────────── */}
              {hasGbp && (
                <div style={{ background: 'rgba(52,168,83,0.04)', border: '1px solid rgba(52,168,83,0.12)', borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <Building2 size={14} color="#34a853" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34a853', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Google Business Profile Settings</span>
                  </div>

                  <GbpHealthWidgets />

                  {/* Post Type */}
                  <div style={{ marginTop: '4px' }}>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '3px' }}>Classificazione Post (Richiesto da Google)</label>
                    <select value={gbpTopicType} onChange={e => setGbpTopicType(e.target.value as any)}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
                      <option value="STANDARD">Notizia / Aggiornamento standard (Novità)</option>
                      <option value="EVENT">Evento Locale</option>
                      <option value="OFFER">Offerta / Promozione Speciale</option>
                    </select>
                  </div>

                  {/* Event & Offer Configs */}
                  {(gbpTopicType === 'EVENT' || gbpTopicType === 'OFFER') && (
                    <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '8px', padding: '0.6rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        📅 Programmazione {gbpTopicType === 'OFFER' ? 'Offerta' : 'Evento'}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Data Inizio</label>
                          <input type="date" value={gbpStartDate} onChange={e => setGbpStartDate(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Ora Inizio (Opz)</label>
                          <input type="time" value={gbpStartTime} onChange={e => setGbpStartTime(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Data Fine</label>
                          <input type="date" value={gbpEndDate} onChange={e => setGbpEndDate(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Ora Fine (Opz)</label>
                          <input type="time" value={gbpEndTime} onChange={e => setGbpEndTime(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
                        </div>
                      </div>

                      {gbpTopicType === 'OFFER' && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Codice Sconto (Es. PROMO2026)</label>
                            <input value={gbpCouponCode} onChange={e => setGbpCouponCode(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Termini e Condizioni (Opz)</label>
                            <input value={gbpTermsConditions} onChange={e => setGbpTermsConditions(e.target.value)} style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc', padding: '4px', fontSize: '0.75rem' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Call to Action Button */}
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '3px' }}>Pulsante Call-to-Action</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={gbpActionType} onChange={e => setGbpActionType(e.target.value as any)}
                        style={{ width: '140px', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 8px', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}>
                        <option value="ACTION_TYPE_UNSPECIFIED">Nessuno</option>
                        <option value="BOOK">Prenota</option>
                        <option value="ORDER">Ordina online</option>
                        <option value="SHOP">Acquista</option>
                        <option value="LEARN_MORE">Scopri di più</option>
                        <option value="SIGN_UP">Iscriviti</option>
                        <option value="CALL">Chiama ora</option>
                      </select>
                      {gbpActionType && gbpActionType !== 'ACTION_TYPE_UNSPECIFIED' && gbpActionType !== 'CALL' && (
                        <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                          placeholder="Link (es. https://miosito.it)"
                          style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none' }} />
                      )}
                    </div>
                  </div>
                  
                  <GbpStoreHoursQuickEditor />
                </div>
              )}

              {/* ── META / LINKEDIN EXTRA FIELDS ─────────────── */}
              {(hasFacebook || hasInstagram || hasLinkedIn) && (
                <div style={{ background: hasLinkedIn ? 'rgba(10,102,194,0.04)' : 'rgba(24,119,242,0.04)', border: '1px solid ' + (hasLinkedIn ? 'rgba(10,102,194,0.12)' : 'rgba(24,119,242,0.12)'), borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    {hasLinkedIn ? <Linkedin size={14} color="#0a66c2" /> : <Facebook size={14} color="#1877f2" />}
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: hasLinkedIn ? '#0a66c2' : '#1877f2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {hasLinkedIn ? 'LinkedIn' : 'Facebook'} {hasInstagram && '/ Intagram'} Settings
                    </span>
                  </div>

                  {/* First Comment */}
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: '3px' }}>
                      💬 Primo Commento automatico 
                      {hasLinkedIn && <span style={{ color: '#0a66c2', marginLeft: '4px' }}>— Vitale per il Dwell Time (no link nel post, sì nel commento)</span>}
                    </label>
                    <input value={firstComment} onChange={e => setFirstComment(e.target.value)}
                      placeholder="#hashtag1 #hashtag2 — o un link esterno..."
                      style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>

                  {/* Location */}
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                      <MapPin size={10} /> Luogo / Location (opzionale)
                    </label>
                    <input value={locationName} onChange={e => setLocationName(e.target.value)}
                      placeholder="Es: Milano, Italy"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '7px', padding: '5px 9px', fontSize: '0.82rem', outline: 'none', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                  </div>

                  {/* Cross-posting toggles */}
                  {hasFacebook && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={crossPostIG} onChange={e => setCrossPostIG(e.target.checked)} />
                        <Instagram size={12} color="#e1306c" /> Pubblica anche su Instagram
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <input type="checkbox" checked={crossPostThreads} onChange={e => setCrossPostThreads(e.target.checked)} />
                        🧵 Pubblica anche su Threads
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hashtag */}
            <div style={{ padding: '0 1rem 0.75rem' }}>
              <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#hashtag1 #hashtag2"
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '0.82rem', color: '#a78bfa', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              
              {hasTiktok && (
                <TiktokKeywordSuggestions onAdd={(kw) => setHashtags(h => h + ` ${kw}`)} />
              )}
            </div>

            {/* Bottom toolbar — two rows */}
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
              {/* Row 1: datetime + status + charcount */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.04)', flexWrap: 'wrap' }}>
                <input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '4px 8px', fontSize: '0.78rem', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', flex: 1, minWidth: '160px' }} />
                <select value={status} onChange={e => setStatus(e.target.value as PostStatus)}
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '4px 8px', fontSize: '0.78rem', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}>
                  {(Object.entries(STATUS_CONFIG) as [PostStatus, any][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <span style={{ fontSize: '0.72rem', color: charCount > charLimit ? '#f87171' : 'var(--text-tertiary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {charCount}/{charLimit.toLocaleString()}
                </span>
              </div>
              {/* Row 2: actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem' }}>
                <div>
                  {!isNew && onDelete && (
                    <button onClick={onDelete} style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
                      <Trash2 size={14} /> Elimina
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button onClick={handleSave} disabled={saving || platforms.length===0} className="btn-gorgeous"
                    style={{ padding: '7px 18px', fontSize: '0.85rem', opacity: platforms.length===0 ? 0.5 : 1 }}>
                    {saving ? '...' : isNew ? 'Salva bozza' : 'Salva'}
                  </button>
                  {publishAt && platforms.length > 0 && (
                    <button onClick={handleSchedule} disabled={saving}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '10px', border: '1.5px solid #a78bfa', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
                      <Send size={13} /> Programma
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Live Preview */}
          <div style={{ width: '380px', flexShrink: 0, background: 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Preview platform tabs */}
            <div style={{ display: 'flex', gap: '4px', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, flexWrap: 'wrap' }}>
              {platforms.map(p => {
                const cfg = PLATFORM_CONFIG[p]
                const Icon = cfg.icon
                return (
                  <button key={p} onClick={() => setPreviewPlatform(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px',
                      border: `1.5px solid ${previewPlatform===p ? cfg.color : 'rgba(0,0,0,0.08)'}`,
                      background: previewPlatform===p ? cfg.bg : 'transparent', cursor: 'pointer',
                      fontSize: '0.72rem', fontWeight: 700, color: previewPlatform===p ? cfg.color : 'var(--text-tertiary)',
                    }}>
                    <Icon size={11} /> {cfg.label}
                  </button>
                )
              })}
              {platforms.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Seleziona almeno una piattaforma</span>}
            </div>

            {/* Preview output */}
            <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              {platforms.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', maxWidth: '340px' }}>
                  <LivePreview 
                    platform={previewPlatform} 
                    caption={caption} 
                    postType={postType} 
                    mediaUrls={mediaUrlsList.map(u => u.startsWith('/') ? `${API_URL}${u}` : u)}
                    coverUrl={coverUrl[0] ? (coverUrl[0].startsWith('/') ? `${API_URL}${coverUrl[0]}` : coverUrl[0]) : undefined}
                    clientName={clientName} 
                  />
                  {/* Instagram Grid Preview */}
                  {hasInstagram && ['PHOTO','CAROUSEL','REEL'].includes(postType) && (
                    <InstagramGridPreview
                      newMediaUrl={mediaUrlsList[0] ? (mediaUrlsList[0].startsWith('/') ? `${API_URL}${mediaUrlsList[0]}` : mediaUrlsList[0]) : undefined}
                      postType={postType}
                    />
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: '3rem' }}>
                  <Eye size={36} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                  <p>Seleziona una piattaforma per vedere l&apos;anteprima</p>
                </div>
              )}
            </div>
            
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
              ℹ️ Le anteprime sono un&apos;approssimazione. Il post finale potrebbe sembrare leggermente diverso.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CALENDAR PAGE ─────────────────────────────────────────────────────────────
export default function ContentCalendarPage() {
  const { id: clientId } = useParams() as { id: string }
  const [posts,   setPosts]   = useState<OrganicPost[]>([])
  const [loading, setLoading] = useState(true)
  const [viewYear,  setViewYear]  = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [clientName, setClientName] = useState('Il tuo brand')
  const todayRef = useRef(new Date())
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL')
  const [filterStatus,   setFilterStatus]   = useState<string>('ALL')
  const [modalPost,        setModalPost]        = useState<OrganicPost | null | undefined>(undefined)
  const [modalDefaultDate, setModalDefaultDate] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/clients/${clientId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.name) setClientName(d.name) }).catch(() => {})
  }, [clientId])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    const month = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}`
    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}/organic?month=${month}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      if (res.ok) setPosts(await res.json())
    } catch {} finally { setLoading(false) }
  }, [clientId, viewYear, viewMonth])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleDelete = async (postId: string) => {
    if (!confirm('Eliminare questo post?')) return
    await fetch(`${API_URL}/api/organic/${postId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
    setModalPost(undefined); fetchPosts()
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay    = getFirstDayOfMonth(viewYear, viewMonth)
  const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7
  const today       = todayRef.current

  const getPostsForDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return posts.filter(p => {
      if (!p.publishAt || new Date(p.publishAt).toISOString().slice(0,10) !== dateStr) return false
      const pps = p.platforms?.length ? p.platforms : [p.platform]
      if (filterPlatform !== 'ALL' && !pps.includes(filterPlatform as Platform)) return false
      if (filterStatus   !== 'ALL' && p.status !== filterStatus) return false
      return true
    }).sort((a,b) => (a.publishAt||'') < (b.publishAt||'') ? -1 : 1)
  }

  const totalScheduled = posts.filter(p => p.status==='SCHEDULED').length
  const totalPublished = posts.filter(p => p.status==='PUBLISHED').length
  const totalDraft     = posts.filter(p => ['DRAFT','READY'].includes(p.status)).length

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/clients/${clientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          <ArrowLeft size={15} /> Dashboard Cliente
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>Content <span style={{ color: '#a78bfa' }}>Calendar.</span></h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Piano editoriale organico · {MONTH_NAMES[viewMonth]} {viewYear}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={fetchPosts} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '0.6rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', display: 'block' }} />
            </button>
            
            <Link href={`/clients/${clientId}/stories/new`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontSize: '0.875rem', background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 600, boxShadow: '0 4px 14px rgba(244,63,94,0.3)' }}>
              📱 Crea Konva Story
            </Link>

            <button onClick={() => { setModalDefaultDate(null); setModalPost(null) }} className="btn-gorgeous" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontSize: '0.875rem' }}>
              <Plus size={16} /> Nuovo Post
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
        {[{ label:'Schedulati', value:totalScheduled, color:'#a78bfa', bg:'rgba(167,139,250,0.08)' },
          { label:'Pubblicati',  value:totalPublished, color:'#34d399', bg:'rgba(52,211,153,0.08)'  },
          { label:'In bozza',   value:totalDraft,     color:'#94a3b8', bg:'rgba(148,163,184,0.08)' }].map(s => (
          <div key={s.label} className="glass-table" style={{ padding: '1rem 1.25rem', borderRadius: '14px', background: s.bg, border: `1px solid ${s.color}20` }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: s.color, fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters + nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => { if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)}else setViewMonth(m=>m-1) }} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer' }}><ChevronLeft size={16}/></button>
          <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: '160px', textAlign: 'center' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
          <button onClick={() => { if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)}else setViewMonth(m=>m+1) }} style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer' }}><ChevronRight size={16}/></button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={filterPlatform} onChange={e=>setFilterPlatform(e.target.value)} style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '0.4rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <option value="ALL">Tutte le piattaforme</option>
            {(Object.entries(PLATFORM_CONFIG) as [Platform, any][]).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', padding: '0.4rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer' }}>
            <option value="ALL">Tutti gli stati</option>
            {(Object.entries(STATUS_CONFIG) as [PostStatus, any][]).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="glass-panel" style={{ borderRadius: '20px', overflow: 'hidden', padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: totalCells }).map((_, idx) => {
            const dayNum = idx - firstDay + 1
            const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
            const isToday = isCurrentMonth && dayNum===today.getDate() && viewMonth===today.getMonth() && viewYear===today.getFullYear()
            const dayPosts = isCurrentMonth ? getPostsForDay(dayNum) : []
            const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
            return (
              <div key={idx} onClick={() => { if (!isCurrentMonth) return; setModalDefaultDate(dateStr); setModalPost(null) }}
                style={{ minHeight: '110px', padding: '0.5rem', borderRight: (idx+1)%7===0?'none':'1px solid rgba(0,0,0,0.05)', borderBottom: idx>=totalCells-7?'none':'1px solid rgba(0,0,0,0.05)', background: isToday?'rgba(167,139,250,0.07)':isCurrentMonth?'transparent':'rgba(0,0,0,0.015)', cursor: isCurrentMonth?'pointer':'default', transition: 'background 0.12s' }}
                onMouseEnter={e => { if (isCurrentMonth) (e.currentTarget as HTMLElement).style.background = isToday?'rgba(167,139,250,0.12)':'rgba(0,0,0,0.02)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isToday?'rgba(167,139,250,0.07)':isCurrentMonth?'transparent':'rgba(0,0,0,0.015)' }}>
                <div style={{ fontSize: '0.73rem', fontWeight: isToday?800:500, color: isToday?'#a78bfa':isCurrentMonth?'var(--text-primary)':'var(--text-tertiary)', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday?'rgba(167,139,250,0.2)':'transparent', marginBottom: '4px' }}>
                  {isCurrentMonth ? dayNum : ''}
                </div>
                {dayPosts.map(p => <PostChip key={p.id} post={p} onClick={e => { e.stopPropagation(); setModalPost(p) }} />)}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {(Object.entries(PLATFORM_CONFIG) as [Platform, any][]).map(([k,v]) => {
          const Icon = v.icon
          return <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.73rem', color: 'var(--text-secondary)' }}><Icon size={11} color={v.color} /> {v.label}</span>
        })}
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>📥 Supporta import da Piano Editoriale via API</span>
      </div>

      {modalPost !== undefined && (
        <PostModal
          post={modalPost} defaultDate={modalDefaultDate} clientId={clientId} clientName={clientName}
          onClose={() => { setModalPost(undefined); setModalDefaultDate(null) }}
          onSave={() => { setModalPost(undefined); setModalDefaultDate(null); fetchPosts() }}
          onDelete={modalPost ? () => handleDelete(modalPost.id) : undefined}
        />
      )}
    </div>
  )
}
