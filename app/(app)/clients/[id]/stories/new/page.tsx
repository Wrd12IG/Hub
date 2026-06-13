"use client"

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Smartphone, Image as ImageIcon, Type, Layers, Wand2, Download, Save, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react'

// --- Types ---
type LayerType = 'text' | 'image' | 'sticker'

interface TextLayer {
  id: string
  type: 'text'
  content: string
  x: number
  y: number
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  align: 'left' | 'center' | 'right'
  color: string
}

type Layer = TextLayer

// --- Sub-components ---
function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
        border: 'none',
        background: active ? 'rgba(236,72,153,0.1)' : 'none',
        color: active ? '#ec4899' : 'var(--text-tertiary)',
        cursor: 'pointer',
        borderRadius: '12px',
        padding: '0.25rem',
        width: '64px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: active ? 'rgba(236,72,153,0.15)' : 'rgba(0,0,0,0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} />
      </div>
      <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{label}</span>
    </button>
  )
}

function TextPropertiesPanel({
  layer,
  onChange,
}: {
  layer: TextLayer
  onChange: (updated: Partial<TextLayer>) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: 0 }}>
        Proprietà Testo
      </h3>

      {/* Content */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Contenuto</label>
        <textarea
          value={layer.content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={3}
          style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {/* Font Size */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Dimensione: {layer.fontSize}px</label>
        <input
          type="range"
          min={12}
          max={120}
          value={layer.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      {/* Color */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Colore</label>
        <input
          type="color"
          value={layer.color}
          onChange={(e) => onChange({ color: e.target.value })}
          style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }}
        />
      </div>

      {/* Style */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Stile</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onChange({ fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold' })}
            style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: layer.fontWeight === 'bold' ? '#ec4899' : 'white', color: layer.fontWeight === 'bold' ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => onChange({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })}
            style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: layer.fontStyle === 'italic' ? '#ec4899' : 'white', color: layer.fontStyle === 'italic' ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <Italic size={14} />
          </button>
        </div>
      </div>

      {/* Alignment */}
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Allineamento</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['left', 'center', 'right'] as const).map((align) => {
            const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
            return (
              <button
                key={align}
                onClick={() => onChange({ align })}
                style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: layer.align === align ? '#ec4899' : 'white', color: layer.align === align ? 'white' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
              >
                <Icon size={14} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EmptyPropertiesPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: '2rem' }}>
      <p style={{ fontSize: '0.85rem' }}>Seleziona o aggiungi un elemento per vedere le sue proprietà.</p>
    </div>
  )
}

// --- Main Page ---
export default function KonvaStoryEditor({ params }: { params: { id: string } }) {
  const { id } = params
  const [layers, setLayers] = useState<Layer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<LayerType | null>(null)

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null

  const addTextLayer = useCallback(() => {
    const newLayer: TextLayer = {
      id: `text-${Date.now()}`,
      type: 'text',
      content: 'Testo di esempio',
      x: 50,
      y: 50,
      fontSize: 32,
      fontWeight: 'bold',
      fontStyle: 'normal',
      align: 'center',
      color: '#ffffff',
    }
    setLayers((prev) => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
    setActiveTool('text')
  }, [])

  const updateSelectedLayer = useCallback((updates: Partial<TextLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === selectedLayerId ? { ...l, ...updates } : l))
    )
  }, [selectedLayerId])

  const tools = [
    { icon: Layers, label: 'Livelli', type: 'sticker' as LayerType, action: () => setActiveTool('sticker') },
    { icon: ImageIcon, label: 'Sfondo', type: 'image' as LayerType, action: () => setActiveTool('image') },
    { icon: Type, label: 'Testo', type: 'text' as LayerType, action: addTextLayer },
    { icon: Wand2, label: 'Stickers', type: 'sticker' as LayerType, action: () => setActiveTool('sticker') },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link
            href={`/clients/${id}/calendar`}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={20} color="#ec4899" />
              Story Editor{' '}
              <span style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, #ec4899, #f43f5e)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, verticalAlign: 'middle', marginLeft: '0.5rem' }}>
                BETA
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Crea grafiche 9:16 per Instagram e TikTok</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'white', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Save size={14} /> Salva Bozza
          </button>
          <button
            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#ec4899', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={14} /> Esporta Media
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Toolbar */}
        <div style={{ width: '80px', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0', gap: '0.75rem', flexShrink: 0 }}>
          {tools.map((tool) => (
            <ToolButton
              key={tool.label}
              icon={tool.icon}
              label={tool.label}
              active={activeTool === tool.type && tool.label === 'Testo'}
              onClick={tool.action}
            />
          ))}
        </div>

        {/* Canvas Area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f1f5f9', position: 'relative', overflow: 'auto' }}>
          {/* Simulated 9:16 Canvas */}
          <div
            style={{
              width: '360px',
              height: '640px',
              background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              border: '4px solid rgba(255,255,255,0.1)',
              position: 'relative',
              overflow: 'hidden',
              flexShrink: 0,
            }}
            onClick={() => setSelectedLayerId(null)}
          >
            {/* Render text layers */}
            {layers.map((layer) => {
              if (layer.type !== 'text') return null
              return (
                <div
                  key={layer.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedLayerId(layer.id) }}
                  style={{
                    position: 'absolute',
                    top: `${layer.y}px`,
                    left: `${layer.x}px`,
                    right: `${layer.x}px`,
                    color: layer.color,
                    fontSize: `${layer.fontSize}px`,
                    fontWeight: layer.fontWeight,
                    fontStyle: layer.fontStyle,
                    textAlign: layer.align,
                    cursor: 'pointer',
                    padding: '4px',
                    border: selectedLayerId === layer.id ? '2px dashed rgba(236,72,153,0.8)' : '2px dashed transparent',
                    borderRadius: '4px',
                  }}
                >
                  {layer.content}
                </div>
              )
            })}

            {/* Empty state */}
            {layers.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)', gap: '1rem' }}>
                <Smartphone size={48} />
                <p style={{ fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>Canvas vuoto<br />Usa gli strumenti a sinistra</p>
              </div>
            )}

            {/* Resolution badge */}
            <div style={{ position: 'absolute', bottom: '1rem', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                1080 × 1920
              </div>
            </div>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div style={{ width: '280px', background: '#fff', borderLeft: '1px solid rgba(0,0,0,0.08)', padding: '1.5rem', overflowY: 'auto', flexShrink: 0 }}>
          {selectedLayer?.type === 'text' ? (
            <TextPropertiesPanel
              layer={selectedLayer}
              onChange={updateSelectedLayer}
            />
          ) : (
            <EmptyPropertiesPanel />
          )}
        </div>
      </div>
    </div>
  )
}
