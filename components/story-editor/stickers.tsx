'use client';

/**
 * components/story-editor/stickers.tsx
 *
 * Gli sticker «disegnati»: stessa figura di quelli di Instagram, ma sono solo grafica nella storia (l'API ufficiale non
 * pubblica sticker interattivi). Ogni sticker è un gruppo Konva con misure proprie.
 */
import React from 'react';
import Konva from 'konva';
import { Rect, Text } from 'react-konva';
import type { StickerLayer } from '@/lib/story-editor/types';
import { formatCountdownEnd } from '@/lib/story-editor/countdown';

const FONT = 'Montserrat';

/** Larghezza di un testo con quel carattere, per far stare la pillola attorno. */
export function measure(text: string, fontSize: number, fontStyle = 'bold', fontFamily = FONT): number {
    const t = new Konva.Text({ text, fontSize, fontFamily, fontStyle });
    return t.width();
}

export function stickerSize(l: StickerLayer): { width: number; height: number } {
    switch (l.sticker) {
        case 'link': case 'hashtag': case 'mention': case 'location': {
            const label = l.sticker === 'hashtag' ? `#${l.text}` : l.sticker === 'mention' ? `@${l.text}` : l.text.toUpperCase();
            return { width: Math.min(960, Math.max(300, measure(label, 52) + 170)), height: 128 };
        }
        case 'music': return { width: 660, height: 150 };
        case 'poll': return { width: 660, height: 250 };
        case 'question': return { width: 660, height: 260 };
        case 'quiz': return { width: 660, height: 120 + 110 * Math.max(2, l.options.length) };
        case 'slider': return { width: 660, height: 190 };
        case 'countdown': return { width: 660, height: 300 };
    }
}

const WHITE = '#ffffff';
const SHADOW = { shadowColor: 'rgba(0,0,0,0.25)', shadowBlur: 24, shadowOffsetY: 8, shadowOpacity: 1 };

function Pill({ l, icon, label, color }: { l: StickerLayer; icon: string; label: string; color: string }) {
    const { width, height } = stickerSize(l);
    return (
        <>
            <Rect width={width} height={height} cornerRadius={height / 2} fill={WHITE} {...SHADOW} />
            <Text x={42} y={0} height={height} verticalAlign="middle" text={icon} fontSize={52} fontFamily={FONT} fill={color} />
            <Text x={110} y={0} width={width - 140} height={height} verticalAlign="middle" text={label} fontSize={52} fontFamily={FONT} fontStyle="bold" fill={color} wrap="none" ellipsis />
        </>
    );
}

export function StickerShape({ layer: l }: { layer: StickerLayer }) {
    const { width, height } = stickerSize(l);
    switch (l.sticker) {
        case 'link': return <Pill l={l} icon="🔗" label={l.text.toUpperCase()} color="#1d9bf0" />;
        case 'hashtag': return <Pill l={l} icon="" label={`#${l.text}`} color="#e1306c" />;
        case 'mention': return <Pill l={l} icon="" label={`@${l.text}`} color="#ff7a00" />;
        case 'location': return <Pill l={l} icon="📍" label={l.text.toUpperCase()} color="#6c2bd9" />;
        case 'music':
            return (
                <>
                    <Rect width={width} height={height} cornerRadius={36} fill={WHITE} {...SHADOW} />
                    <Rect x={24} y={24} width={102} height={102} cornerRadius={20} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: 102, y: 102 }} fillLinearGradientColorStops={[0, '#f09433', 1, '#bc1888']} />
                    <Text x={24} y={24} width={102} height={102} align="center" verticalAlign="middle" text="🎵" fontSize={52} />
                    <Text x={150} y={34} width={width - 180} text={l.text} fontSize={40} fontFamily={FONT} fontStyle="bold" fill="#111827" wrap="none" ellipsis />
                    <Text x={150} y={86} width={width - 180} text="Artista" fontSize={32} fontFamily={FONT} fill="#6b7280" wrap="none" ellipsis />
                </>
            );
        case 'poll': {
            const [a = 'Sì', b = 'No'] = l.options;
            return (
                <>
                    <Rect width={width} height={height} cornerRadius={36} fill={WHITE} {...SHADOW} />
                    <Text x={30} y={26} width={width - 60} height={110} align="center" verticalAlign="middle" text={l.text} fontSize={44} fontFamily={FONT} fontStyle="bold" fill="#111827" />
                    <Rect x={26} y={146} width={(width - 76) / 2} height={80} cornerRadius={24} fill="#f3f4f6" />
                    <Rect x={50 + (width - 76) / 2} y={146} width={(width - 76) / 2} height={80} cornerRadius={24} fill="#f3f4f6" />
                    <Text x={26} y={146} width={(width - 76) / 2} height={80} align="center" verticalAlign="middle" text={a} fontSize={38} fontFamily={FONT} fontStyle="bold" fill="#e1306c" />
                    <Text x={50 + (width - 76) / 2} y={146} width={(width - 76) / 2} height={80} align="center" verticalAlign="middle" text={b} fontSize={38} fontFamily={FONT} fontStyle="bold" fill="#1d9bf0" />
                </>
            );
        }
        case 'question':
            return (
                <>
                    <Rect width={width} height={height} cornerRadius={36} fill={WHITE} {...SHADOW} />
                    <Rect width={width} height={96} cornerRadius={[36, 36, 0, 0]} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: width, y: 0 }} fillLinearGradientColorStops={[0, '#833ab4', 0.5, '#e1306c', 1, '#fcb045']} />
                    <Text x={20} y={0} width={width - 40} height={96} align="center" verticalAlign="middle" text={l.text} fontSize={40} fontFamily={FONT} fontStyle="bold" fill={WHITE} />
                    <Rect x={30} y={130} width={width - 60} height={100} cornerRadius={22} fill="#f3f4f6" />
                    <Text x={30} y={130} width={width - 60} height={100} align="center" verticalAlign="middle" text="Scrivi qualcosa…" fontSize={34} fontFamily={FONT} fill="#9ca3af" />
                </>
            );
        case 'quiz': {
            const opts = l.options.length ? l.options : ['Risposta A', 'Risposta B'];
            return (
                <>
                    <Rect width={width} height={height} cornerRadius={36} fill={WHITE} {...SHADOW} />
                    <Text x={30} y={16} width={width - 60} height={100} align="center" verticalAlign="middle" text={l.text} fontSize={42} fontFamily={FONT} fontStyle="bold" fill="#111827" />
                    {opts.map((o, i) => (
                        <React.Fragment key={i}>
                            <Rect x={30} y={124 + i * 110} width={width - 60} height={92} cornerRadius={46} stroke="#d1d5db" strokeWidth={4} fill={i === 0 ? '#ecfdf5' : '#ffffff'} />
                            <Text x={30} y={124 + i * 110} width={width - 60} height={92} align="center" verticalAlign="middle" text={o} fontSize={36} fontFamily={FONT} fontStyle="bold" fill="#111827" />
                        </React.Fragment>
                    ))}
                </>
            );
        }
        case 'slider':
            return (
                <>
                    <Rect width={width} height={height} cornerRadius={36} fill={WHITE} {...SHADOW} />
                    <Text x={30} y={18} width={width - 60} height={70} align="center" verticalAlign="middle" text={l.text} fontSize={38} fontFamily={FONT} fontStyle="bold" fill="#111827" />
                    <Rect x={50} y={126} width={width - 100} height={18} cornerRadius={9} fill="#e5e7eb" />
                    <Rect x={50} y={126} width={(width - 100) * 0.62} height={18} cornerRadius={9} fillLinearGradientStartPoint={{ x: 0, y: 0 }} fillLinearGradientEndPoint={{ x: width, y: 0 }} fillLinearGradientColorStops={[0, '#833ab4', 1, '#e1306c']} />
                    <Text x={50 + (width - 100) * 0.62 - 38} y={100} text="😍" fontSize={72} />
                </>
            );
        case 'countdown': {
            const end = formatCountdownEnd(l.endAt);
            const cw = (width - 90) / 2;
            return (
                <>
                    <Rect width={width} height={height} cornerRadius={36} fill={WHITE} {...SHADOW} />
                    <Text x={30} y={16} width={width - 60} height={80} align="center" verticalAlign="middle" text={l.text.toUpperCase()} fontSize={40} fontFamily={FONT} fontStyle="bold" fill="#111827" />
                    <Rect x={30} y={110} width={cw} height={140} cornerRadius={22} fill="#f3f4f6" />
                    <Text x={30} y={126} width={cw} align="center" text={end ? end.day : '-- ---'} fontSize={60} fontFamily={FONT} fontStyle="bold" fill="#e1306c" />
                    <Text x={30} y={206} width={cw} align="center" text={end ? end.weekday : 'DATA'} fontSize={24} fontFamily={FONT} fontStyle="bold" fill="#6b7280" />
                    <Rect x={60 + cw} y={110} width={cw} height={140} cornerRadius={22} fill="#f3f4f6" />
                    <Text x={60 + cw} y={126} width={cw} align="center" text={end ? end.time : '--:--'} fontSize={60} fontFamily={FONT} fontStyle="bold" fill="#e1306c" />
                    <Text x={60 + cw} y={206} width={cw} align="center" text="ORE" fontSize={24} fontFamily={FONT} fontStyle="bold" fill="#6b7280" />
                </>
            );
        }
    }
}

