/**
 * lib/story-editor/snap.ts
 *
 * Guide magnetiche: mentre si trascina un livello, il suo bordo o il suo centro si «attaccano» ai bordi e al centro
 * della tela, ai margini sicuri e agli altri livelli. Pura.
 */
import { SAFE_BOTTOM, SAFE_TOP, STORY_H, STORY_W, type Rect } from './types';

export interface SnapResult {
    /** Spostamento da sommare alla posizione del livello (0 se non si aggancia). */
    dx: number;
    dy: number;
    /** Linee guida da disegnare, in coordinate della storia. */
    vertical: number[];
    horizontal: number[];
}

const nearest = (candidates: number[], targets: number[], threshold: number): { delta: number; line: number } | null => {
    let best: { delta: number; line: number } | null = null;
    for (const c of candidates) {
        for (const t of targets) {
            const delta = t - c;
            if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, line: t };
        }
    }
    return best;
};

export function computeSnap(box: Rect, others: Rect[], threshold = 14): SnapResult {
    const xs = [0, STORY_W / 2, STORY_W, 60, STORY_W - 60];
    const ys = [0, STORY_H / 2, STORY_H, SAFE_TOP, STORY_H - SAFE_BOTTOM];
    for (const o of others) {
        xs.push(o.x, o.x + o.width / 2, o.x + o.width);
        ys.push(o.y, o.y + o.height / 2, o.y + o.height);
    }
    const mine = {
        x: [box.x, box.x + box.width / 2, box.x + box.width],
        y: [box.y, box.y + box.height / 2, box.y + box.height],
    };
    const sx = nearest(mine.x, xs, threshold);
    const sy = nearest(mine.y, ys, threshold);
    return { dx: sx?.delta ?? 0, dy: sy?.delta ?? 0, vertical: sx ? [sx.line] : [], horizontal: sy ? [sy.line] : [] };
}
