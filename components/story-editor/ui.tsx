'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export const SWATCHES = ['#ffffff', '#000000', '#111827', '#ec4899', '#f43f5e', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <label className={cn('block space-y-1', className)}>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            {children}
        </label>
    );
}

export const inputCls = 'w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500';

export function ColorField({ label, value, onChange, allowClear, extra = [] }: { label: string; value: string; onChange: (v: string) => void; allowClear?: boolean; extra?: string[] }) {
    return (
        <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
            <div className="flex flex-wrap items-center gap-1.5">
                {allowClear && (
                    <button type="button" title="Nessuno" onClick={() => onChange('')}
                        className={cn('h-6 w-6 rounded-full border text-[10px] text-slate-400', !value ? 'border-sky-500' : 'border-slate-600')}>∅</button>
                )}
                {[...extra, ...SWATCHES].map((c) => (
                    <button key={c} type="button" title={c} onClick={() => onChange(c)} style={{ background: c }}
                        className={cn('h-6 w-6 rounded-full border', value.toLowerCase() === c.toLowerCase() ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-600')} />
                ))}
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: colore personalizzato`}
                    className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-transparent p-0" />
            </div>
        </div>
    );
}

export function Range({ label, value, min, max, step = 1, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
    return (
        <Field label={`${label} · ${Math.round(value * 100) / 100}${suffix}`}>
            <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-sky-500" />
        </Field>
    );
}

export function Toggle({ pressed, onClick, children, title }: { pressed: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
    return (
        <button type="button" aria-pressed={pressed} title={title} onClick={onClick}
            className={cn('flex-1 rounded-md border px-2 py-1.5 text-sm', pressed ? 'border-sky-500 bg-sky-500/20 text-sky-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800')}>
            {children}
        </button>
    );
}
