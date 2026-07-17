import React from 'react';
import { Instagram, Facebook, Linkedin, Music, Youtube, Building2, ImageIcon, Play, Heart, MessageCircle, Send, Bookmark, ThumbsUp, Share2, Video } from 'lucide-react';

type Platform = 'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'TIKTOK' | 'YOUTUBE' | 'GOOGLE_BUSINESS';
type PostType = 'PHOTO' | 'CAROUSEL' | 'VIDEO' | 'REEL' | 'STORY' | 'LINK' | 'TEXT' | 'DOCUMENT';

const PLATFORM_CONFIG: Record<Platform, { icon: React.FC<any>; color: string; bg: string; label: string; charLimit: number }> = {
  INSTAGRAM:       { icon: Instagram,  color: '#e1306c', bg: 'rgba(225,48,108,0.12)',  label: 'Instagram',       charLimit: 2200 },
  FACEBOOK:        { icon: Facebook,   color: '#1877f2', bg: 'rgba(24,119,242,0.12)', label: 'Facebook',        charLimit: 63206 },
  LINKEDIN:        { icon: Linkedin,   color: '#0a66c2', bg: 'rgba(10,102,194,0.12)', label: 'LinkedIn',        charLimit: 3000 },
  TIKTOK:          { icon: Music,      color: '#69c9d0', bg: 'rgba(105,201,208,0.12)',label: 'TikTok',          charLimit: 2200 },
  YOUTUBE:         { icon: Youtube,    color: '#ff0000', bg: 'rgba(255,0,0,0.09)',     label: 'YouTube',         charLimit: 5000 },
  GOOGLE_BUSINESS: { icon: Building2,  color: '#34a853', bg: 'rgba(52,168,83,0.12)',  label: 'Google Business', charLimit: 1500 },
}

export function LivePreview({ platform, caption, postType, mediaUrls, coverUrl, clientName }: {
  platform: Platform; caption: string; postType: PostType; mediaUrls: string[]; coverUrl?: string; clientName: string
}) {
  const pc = PLATFORM_CONFIG[platform]
  const Icon = pc.icon
  const hasMedia = mediaUrls.filter(Boolean).length > 0
  const firstMedia = mediaUrls.filter(Boolean)[0]
  const isVideoPost = postType === 'VIDEO' || postType === 'REEL'
  const firstIsVideo = firstMedia 
    ? /\.(mp4|webm|mov)$/i.test(firstMedia)
    : false
  const previewMedia = isVideoPost ? (coverUrl || firstMedia) : firstMedia
  const showPlayOverlay = isVideoPost && (coverUrl || firstMedia)

  if (platform === 'INSTAGRAM') {
    return (
      <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', maxWidth: '340px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
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
        <div style={{ width: '100%', aspectRatio: (postType === 'REEL' || postType === 'STORY') ? '9/16' : '1', background: '#f0f0f0', overflow: 'hidden', position: 'relative', maxHeight: (postType === 'REEL' || postType === 'STORY') ? '400px' : undefined }}>
          {(hasMedia || coverUrl)
            ? <>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {(coverUrl || !firstIsVideo)
                    ? <img src={previewMedia} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <video src={firstMedia} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} autoPlay muted loop playsInline />
                  }
                </div>
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
        <div style={{ padding: '8px 12px 4px', display: 'flex', gap: '14px', alignItems: 'center' }}>
          <Heart size={24} style={{ cursor: 'pointer', color: '#111' }} strokeWidth={1.8} />
          <MessageCircle size={24} style={{ cursor: 'pointer', transform: 'scaleX(-1)', color: '#111' }} strokeWidth={1.8} />
          <Send size={24} style={{ cursor: 'pointer', transform: 'rotate(15deg) translateY(-2px)', color: '#111' }} strokeWidth={1.8} />
          <Bookmark size={24} style={{ marginLeft: 'auto', cursor: 'pointer', color: '#111' }} strokeWidth={1.8} />
        </div>
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

  return (
    <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', maxWidth: '340px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', padding: '20px', textAlign: 'center' }}>
      <Icon size={40} color={pc.color} />
      <div style={{ marginTop: '16px', fontWeight: 700, fontSize: '14px', color: '#000' }}>{clientName}</div>
      {caption && <p style={{ fontSize: '12px', color: '#444', lineHeight: 1.5, marginTop: '8px' }}>{caption.slice(0,200)}</p>}
      {!caption && <p style={{ fontSize: '12px', color: '#bbb', marginTop: '8px' }}>Inizia a scrivere per vedere l'anteprima...</p>}
    </div>
  )
}
