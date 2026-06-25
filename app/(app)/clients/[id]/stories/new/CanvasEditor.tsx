"use client"

import React, { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Smartphone, Image as ImageIcon, Type, Layers, Wand2, Download, Save, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Stage, Layer, Text as KonvaText, Image as KonvaImage, Transformer } from 'react-konva'
import EmojiPicker, { EmojiClickData, EmojiStyle } from 'emoji-picker-react'

// --- Custom useImage Hook ---
const useImage = (url: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.src = url;
    img.crossOrigin = 'Anonymous';
    img.onload = () => setImage(img);
  }, [url]);
  return [image];
}

// --- Types ---
type LayerType = 'text' | 'image' | 'sticker' | 'layers'

interface BaseLayer {
  id: string
  type: LayerType
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
}

interface TextLayer extends BaseLayer {
  type: 'text'
  content: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  align: 'left' | 'center' | 'right'
  color: string
}

interface ImageLayer extends BaseLayer {
  type: 'image'
  url: string
  width: number
  height: number
}

interface StickerLayer extends BaseLayer {
  type: 'sticker'
  content: string
  fontSize: number // Le emoji sono testo
}

type CanvasLayer = TextLayer | ImageLayer | StickerLayer

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
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', border: 'none',
        background: active ? 'rgba(236,72,153,0.1)' : 'none',
        color: active ? '#ec4899' : 'var(--text-tertiary)',
        cursor: 'pointer', borderRadius: '12px', padding: '0.25rem', width: '64px',
      }}
    >
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: active ? 'rgba(236,72,153,0.15)' : 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} />
      </div>
      <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{label}</span>
    </button>
  )
}

function TextPropertiesPanel({ layer, onChange, onDelete }: { layer: TextLayer, onChange: (updated: Partial<TextLayer>) => void, onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: 0 }}>Proprietà Testo</h3>
          <button onClick={onDelete} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Contenuto</label>
        <textarea value={layer.content} onChange={(e) => onChange({ content: e.target.value })} rows={3} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Colore</label>
        <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value })} style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }} />
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Stile</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => onChange({ fontWeight: layer.fontWeight === 'bold' ? 'normal' : 'bold' })} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: layer.fontWeight === 'bold' ? '#ec4899' : 'white', color: layer.fontWeight === 'bold' ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}><Bold size={14} /></button>
          <button onClick={() => onChange({ fontStyle: layer.fontStyle === 'italic' ? 'normal' : 'italic' })} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: layer.fontStyle === 'italic' ? '#ec4899' : 'white', color: layer.fontStyle === 'italic' ? 'white' : 'var(--text-secondary)', cursor: 'pointer' }}><Italic size={14} /></button>
        </div>
      </div>
      <div>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Allineamento</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['left', 'center', 'right'] as const).map((align) => {
            const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
            return (
              <button key={align} onClick={() => onChange({ align })} style={{ flex: 1, padding: '0.4rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: layer.align === align ? '#ec4899' : 'white', color: layer.align === align ? 'white' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', justifyContent: 'center' }}><Icon size={14} /></button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function LayersPanel({ layers, setLayers, selectedLayerId, setSelectedLayerId }: any) {
    const moveLayer = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === layers.length - 1) return;
        if (direction === 'down' && index === 0) return;
        const newLayers = [...layers];
        const swapIndex = direction === 'up' ? index + 1 : index - 1;
        [newLayers[index], newLayers[swapIndex]] = [newLayers[swapIndex], newLayers[index]];
        setLayers(newLayers);
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: 0 }}>Livelli</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[...layers].reverse().map((layer, idx) => {
                    const actualIndex = layers.length - 1 - idx;
                    return (
                        <div key={layer.id} onClick={() => setSelectedLayerId(layer.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '8px', border: selectedLayerId === layer.id ? '1px solid #ec4899' : '1px solid rgba(0,0,0,0.1)', background: selectedLayerId === layer.id ? 'rgba(236,72,153,0.05)' : 'white', cursor: 'pointer' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{layer.type === 'text' ? 'Testo' : layer.type === 'image' ? 'Sfondo' : 'Sticker'}</span>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button onClick={(e) => { e.stopPropagation(); moveLayer(actualIndex, 'up'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-tertiary)' }}><ArrowUp size={14}/></button>
                                <button onClick={(e) => { e.stopPropagation(); moveLayer(actualIndex, 'down'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-tertiary)' }}><ArrowDown size={14}/></button>
                            </div>
                        </div>
                    )
                })}
                {layers.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: '1rem 0' }}>Nessun livello</p>}
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

// Konva components wrapped with specific logic
const UrlImage = ({ layer, isSelected, onSelect, onChange }: any) => {
  const [image] = useImage(layer.url);
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <React.Fragment>
      <KonvaImage
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        image={image || undefined}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        rotation={layer.rotation}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          // node.scaleX(1);
          // node.scaleY(1);
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scaleX: scaleX,
            scaleY: scaleY,
          });
        }}
      />
      {isSelected && (
        <Transformer ref={trRef} boundBoxFunc={(oldBox, newBox) => newBox} />
      )}
    </React.Fragment>
  );
};

const DraggableText = ({ layer, isSelected, onSelect, onChange }: any) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <React.Fragment>
      <KonvaText
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        text={layer.content}
        x={layer.x}
        y={layer.y}
        fontSize={layer.fontSize}
        fontFamily="sans-serif"
        fontStyle={`${layer.fontWeight === 'bold' ? 'bold ' : ''}${layer.fontStyle === 'italic' ? 'italic' : ''}`.trim() || 'normal'}
        align={layer.align}
        fill={layer.color}
        rotation={layer.rotation}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
            scaleX: scaleX,
            scaleY: scaleY,
          });
        }}
      />
      {isSelected && (
        <Transformer ref={trRef} enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']} boundBoxFunc={(oldBox, newBox) => newBox} />
      )}
    </React.Fragment>
  );
};

// --- Main Component ---
export default function CanvasEditor({ clientId }: { clientId: string }) {
  const [layers, setLayers] = useState<CanvasLayer[]>([])
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<LayerType | null>(null)
  
  // Per scaricare l'immagine
  const stageRef = useRef<any>(null);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null

  const checkDeselect = (e: any) => {
    // deselect when clicked on empty area
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty) {
      setSelectedLayerId(null);
    }
  };

  const addTextLayer = useCallback(() => {
    const newLayer: TextLayer = {
      id: `text-${Date.now()}`, type: 'text', content: 'Doppio click per editare\noppure dal pannello laterale',
      x: 50, y: 150, rotation: 0, scaleX: 1, scaleY: 1,
      fontSize: 24, fontWeight: 'bold', fontStyle: 'normal', align: 'center', color: '#ffffff',
    }
    setLayers((prev) => [...prev, newLayer])
    setSelectedLayerId(newLayer.id)
    setActiveTool('text')
  }, [])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          const newLayer: ImageLayer = { id: `img-${Date.now()}`, type: 'image', url, x: 0, y: 0, width: 360, height: 640, rotation: 0, scaleX: 1, scaleY: 1 };
          setLayers((prev) => [newLayer, ...prev]);
          setSelectedLayerId(newLayer.id);
          setActiveTool('image');
      }
      e.target.value = '';
  }

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const newLayer: StickerLayer = { 
        id: `sticker-${Date.now()}`, type: 'sticker', content: emojiData.emoji, 
        x: 150, y: 300, rotation: 0, scaleX: 1, scaleY: 1, fontSize: 64 
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
    setActiveTool(null); // Chiude il picker
  }

  const handleLayerChange = (updatedLayer: CanvasLayer) => {
    setLayers((prev) => prev.map((l) => (l.id === updatedLayer.id ? updatedLayer : l)))
  }

  const updateSelectedTextLayer = useCallback((updates: Partial<TextLayer>) => {
    setLayers((prev) => prev.map((l) => {
        if (l.id === selectedLayerId && l.type === 'text') {
            return { ...l, ...updates } as TextLayer;
        }
        return l;
    }))
  }, [selectedLayerId])
  
  const deleteSelectedLayer = useCallback(() => {
      setLayers(prev => prev.filter(l => l.id !== selectedLayerId));
      setSelectedLayerId(null);
  }, [selectedLayerId]);

  const handleExport = () => {
    if (!stageRef.current) return;
    setSelectedLayerId(null); // Nascondi i transformer
    setTimeout(() => {
        const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `story-${Date.now()}.png`;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, 100);
  }

  const tools = [
    { icon: Layers, label: 'Livelli', type: 'layers' as any, action: () => setActiveTool('layers') },
    { icon: ImageIcon, label: 'Sfondo', type: 'image' as any, action: () => document.getElementById('bg-upload')?.click() },
    { icon: Type, label: 'Testo', type: 'text' as any, action: addTextLayer },
    { icon: Wand2, label: 'Stickers', type: 'sticker' as any, action: () => setActiveTool('sticker') },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <input type="file" id="bg-upload" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
      
      {/* Header */}
      <div style={{ padding: '1.5rem 2rem', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/clients/${clientId}/calendar`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Smartphone size={20} color="#ec4899" />
              Story Editor <span style={{ fontSize: '0.75rem', background: 'linear-gradient(135deg, #ec4899, #f43f5e)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, verticalAlign: 'middle', marginLeft: '0.5rem' }}>PRO</span>
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Crea grafiche 9:16 per Instagram e TikTok</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'white', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Save size={14} /> Salva Bozza
          </button>
          <button onClick={handleExport} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#ec4899', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Download size={14} /> Esporta Immagine
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Toolbar */}
        <div style={{ width: '80px', background: '#fff', borderRight: '1px solid rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 0', gap: '0.75rem', flexShrink: 0 }}>
          {tools.map((tool) => (
            <ToolButton key={tool.label} icon={tool.icon} label={tool.label} active={activeTool === tool.type} onClick={tool.action} />
          ))}
        </div>

        {/* Canvas Area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f1f5f9', position: 'relative', overflow: 'auto' }}>
            {/* Sticker Picker Modal */}
            {activeTool === 'sticker' && (
                <div style={{ position: 'absolute', left: '2rem', top: '2rem', zIndex: 10, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ background: 'white', padding: '0.5rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Scegli Emoji</span>
                        <button onClick={() => setActiveTool(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>Chiudi</button>
                    </div>
                    <EmojiPicker onEmojiClick={handleEmojiClick} emojiStyle={EmojiStyle.NATIVE} />
                </div>
            )}

          {/* Konva Stage 9:16 */}
          <div style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', borderRadius: '8px', overflow: 'hidden', background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)' }}>
              <Stage width={360} height={640} onMouseDown={checkDeselect} onTouchStart={checkDeselect} ref={stageRef}>
                <Layer>
                    {layers.map((layer) => {
                        if (layer.type === 'image') {
                            return <UrlImage key={layer.id} layer={layer} isSelected={layer.id === selectedLayerId} onSelect={() => setSelectedLayerId(layer.id)} onChange={handleLayerChange} />
                        }
                        if (layer.type === 'text') {
                            return <DraggableText key={layer.id} layer={layer} isSelected={layer.id === selectedLayerId} onSelect={() => setSelectedLayerId(layer.id)} onChange={handleLayerChange} />
                        }
                        if (layer.type === 'sticker') {
                            return <DraggableText key={layer.id} layer={layer} isSelected={layer.id === selectedLayerId} onSelect={() => setSelectedLayerId(layer.id)} onChange={handleLayerChange} />
                        }
                        return null;
                    })}
                </Layer>
              </Stage>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div style={{ width: '280px', background: '#fff', borderLeft: '1px solid rgba(0,0,0,0.08)', padding: '1.5rem', overflowY: 'auto', flexShrink: 0 }}>
          {activeTool === 'layers' ? (
              <LayersPanel layers={layers} setLayers={setLayers} selectedLayerId={selectedLayerId} setSelectedLayerId={setSelectedLayerId} />
          ) : selectedLayer?.type === 'text' ? (
            <TextPropertiesPanel layer={selectedLayer} onChange={updateSelectedTextLayer} onDelete={deleteSelectedLayer} />
          ) : selectedLayer?.type === 'image' || selectedLayer?.type === 'sticker' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', margin: 0 }}>
                        Proprietà {selectedLayer.type === 'image' ? 'Sfondo' : 'Sticker'}
                    </h3>
                    <button onClick={deleteSelectedLayer} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={16} />
                    </button>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Questo livello può essere spostato, ridimensionato e ruotato direttamente cliccandolo sul Canvas.</p>
              </div>
          ) : (
            <EmptyPropertiesPanel />
          )}
        </div>
      </div>
    </div>
  )
}
