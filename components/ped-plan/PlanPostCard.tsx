'use client';

import React from 'react';
import { AlertTriangle, Info, Loader2, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { POST_TYPE_LABEL, type PlanPost, type SkeletonPost } from '@/lib/ped-plan/spec';
import { hookScore } from '@/lib/ped-plan/checks';
import { cn } from '@/lib/utils';
import { ProposalView } from './ProposalView';

export type Slot = { skeleton: SkeletonPost; status: 'waiting' | 'working' | 'ready' | 'error'; post?: PlanPost; error?: string; included: boolean };

const FORMAT_COLOR: Record<string, string> = { Reel: 'bg-rose-500/15 text-rose-700', Carosello: 'bg-indigo-500/15 text-indigo-700', 'Post Singolo': 'bg-emerald-500/15 text-emerald-700', Storia: 'bg-amber-500/15 text-amber-700' };

/** Scambia l'aggancio scelto con un'alternativa: aggiorna anche la prima battuta e la prima scheda, e ricalcola il punteggio. */
export function swapHook(post: PlanPost, index: number): PlanPost {
    const alt = post.hook.alternatives[index];
    if (!alt) return post;
    const old = { spoken: post.hook.spoken, onScreen: post.hook.onScreen, score: post.hookScore };
    const alternatives = post.hook.alternatives.map((a, i) => (i === index ? old : a));
    const reel = post.reel ? {
        ...post.reel,
        script: [alt.spoken, ...post.reel.script.slice(1)],
        cards: post.reel.cards.length > 0 ? [{ ...post.reel.cards[0], text: alt.onScreen || post.reel.cards[0].text }, ...post.reel.cards.slice(1)] : post.reel.cards,
    } : post.reel;
    return { ...post, hook: { ...post.hook, spoken: alt.spoken, onScreen: alt.onScreen, alternatives }, hookScore: hookScore(alt.spoken).score, reel };
}

function Score({ n }: { n?: number }) {
    if (n === undefined) return null;
    return <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', n >= 70 ? 'bg-emerald-500/20 text-emerald-700' : n >= 50 ? 'bg-amber-500/20 text-amber-700' : 'bg-rose-500/20 text-rose-700')} title="Indicatore dell'aggancio: scova gli errori evidenti, non prevede le visualizzazioni">{n}/100</span>;
}

export function PlanPostCard({ slot, onChange, onRetry, onToggle, onSkeleton }: {
    slot: Slot; onChange: (post: PlanPost) => void; onRetry: () => void; onToggle: (v: boolean) => void; onSkeleton: (patch: Partial<SkeletonPost>) => void;
}) {
    const { skeleton: sk, post } = slot;
    return (
        <article className={cn('flex flex-col gap-3 rounded-2xl border bg-card p-4', !slot.included && 'opacity-60')}>
            <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" checked={slot.included} onChange={(e) => onToggle(e.target.checked)} aria-label="Includi nel PED" className="h-4 w-4 accent-amber-500" />
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', FORMAT_COLOR[sk.format])}>{sk.format}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{POST_TYPE_LABEL[sk.postType]}</span>
                <div className="ml-auto flex items-center gap-1.5">
                    <Input type="date" value={sk.date} onChange={(e) => e.target.value && onSkeleton({ date: e.target.value })} className="h-7 w-32 text-xs" />
                    <Input type="time" value={sk.time} onChange={(e) => e.target.value && onSkeleton({ time: e.target.value })} className="h-7 w-24 text-xs" />
                </div>
            </div>
            <div>
                <div className="font-semibold">{sk.theme}</div>
                <div className="text-xs text-muted-foreground">{sk.angle}</div>
            </div>

            {slot.status === 'waiting' && <p className="text-xs text-muted-foreground">In coda…</p>}
            {slot.status === 'working' && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Scrivo il contenuto…</p>}
            {slot.status === 'error' && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                    <span className="flex-1">{slot.error || 'Non riuscito.'}</span>
                    <Button size="sm" variant="outline" onClick={onRetry} className="h-7 gap-1"><RefreshCw className="h-3 w-3" />Riprova</Button>
                </div>
            )}

            {slot.status === 'ready' && post && (
                <>
                    {post.format !== 'Storia' && post.hook.spoken && (
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aggancio <Score n={post.hookScore} /></div>
                            <p className="rounded-md border-l-4 border-amber-500 bg-muted/50 p-2 font-semibold">«{post.hook.spoken}»</p>
                            {post.hook.onScreen && <p className="text-xs text-muted-foreground">A schermo: <b>{post.hook.onScreen}</b></p>}
                            {post.hook.alternatives.map((a, i) => (
                                <button key={i} type="button" onClick={() => onChange(swapHook(post, i))} className="block w-full rounded-md border border-dashed p-1.5 text-left text-xs hover:border-amber-500">
                                    <span className="mr-1.5 inline-block"><Score n={a.score} /></span>{a.spoken} <span className="text-muted-foreground">— usa questo</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <ProposalView post={post} />
                    {post.format !== 'Storia' && (
                        <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Didascalia</div>
                            <Textarea value={post.caption} onChange={(e) => onChange({ ...post, caption: e.target.value })} rows={Math.min(10, Math.max(3, post.caption.split('\n').length + 1))} className="text-sm" />
                            <p className="mt-1 text-[11px] text-muted-foreground">{post.caption.length} caratteri{post.hashtags.length > 0 ? ` · ${post.hashtags.join(' ')}` : ''}</p>
                        </div>
                    )}
                    {post.warnings.length > 0 && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Da controllare</div>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-800">{post.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                        </div>
                    )}
                    {post.missingData.length > 0 && (
                        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700"><Info className="h-3.5 w-3.5" />Con questi dati verrebbe più forte</div>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-sky-800">{post.missingData.map((w, i) => <li key={i}>{w}</li>)}</ul>
                        </div>
                    )}
                    <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={onRetry} className="h-7 gap-1 text-xs"><RefreshCw className="h-3 w-3" />Riscrivi</Button></div>
                </>
            )}
        </article>
    );
}
