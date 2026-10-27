'use client';

/**
 * components/ped-plan/ProposalView.tsx
 * Mostra il lavoro di produzione di una proposta del Piano PED: copione e testi a schermo di un Reel, slide di un carosello,
 * fotogrammi di una storia. Sola lettura: serve a chi produce e a chi rivede. Usato nella pagina del piano e nel PED.
 */
import React from 'react';
import type { PlanPost } from '@/lib/ped-plan/spec';
import { spokenSeconds } from '@/lib/ped-plan/checks';

const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>;

export function ProposalView({ post }: { post: PlanPost }) {
    return (
        <div className="space-y-3 text-sm">
            {post.reel && (
                <>
                    <div>
                        <Label>Copione · circa {post.reel.script.reduce((a, l) => a + spokenSeconds(l), 0).toFixed(0)} secondi</Label>
                        <ol className="space-y-1">
                            {post.reel.script.map((line, i) => (
                                <li key={i} className="flex gap-2 rounded-md bg-muted/50 p-2">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-700">{i + 1}</span>
                                    <span className="flex-1">{line}{post.reel!.shots[i] && <span className="mt-0.5 block text-xs text-muted-foreground">Si vede: {post.reel!.shots[i]}</span>}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    {post.reel.cards.length > 0 && (
                        <div>
                            <Label>Testi a schermo</Label>
                            <ul className="flex flex-wrap gap-1.5">
                                {post.reel.cards.map((c, i) => <li key={i} className="rounded-md border px-2 py-1 text-xs font-semibold">{c.text} <span className="font-normal text-muted-foreground">{c.from}–{c.to} s</span></li>)}
                            </ul>
                        </div>
                    )}
                </>
            )}
            {post.carousel && (
                <div>
                    <Label>Slide ({post.carousel.slides.length})</Label>
                    <ol className="space-y-1">
                        {post.carousel.slides.map((s, i) => (
                            <li key={i} className="flex gap-2 rounded-md bg-muted/50 p-2">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-700">{i + 1}</span>
                                <span><span className="block text-[10px] font-bold uppercase text-muted-foreground">{s.role}</span><span className="font-semibold">{s.headline}</span>{s.body && <span className="block text-muted-foreground">{s.body}</span>}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
            {post.story && (
                <div>
                    <Label>Fotogrammi ({post.story.frames.length})</Label>
                    <ol className="space-y-1">
                        {post.story.frames.map((f, i) => (
                            <li key={i} className="rounded-md bg-muted/50 p-2">
                                <span className="font-semibold">{i + 1}.</span> {f.text}
                                {f.sticker && <span className="mt-1 block text-xs text-sky-700">Sticker {f.sticker}{f.stickerText ? `: «${f.stickerText}»` : ''}{f.options.length > 0 ? ` · ${f.options.join(' / ')}` : ''}</span>}
                            </li>
                        ))}
                    </ol>
                    <p className="mt-1 text-[11px] text-muted-foreground">Gli sticker veri (sondaggio, domanda, link) si aggiungono a mano nell&apos;app di Instagram: nell&apos;immagine sono solo disegnati.</p>
                </div>
            )}
            {post.photoBrief && <div><Label>Che foto serve</Label><p className="text-muted-foreground">{post.photoBrief}</p></div>}
            {post.altText && <div><Label>Testo alternativo</Label><p className="text-muted-foreground">{post.altText}</p></div>}
        </div>
    );
}
