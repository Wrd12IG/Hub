'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EditorialContent } from '@/lib/data';
import { parseProposal } from '@/lib/ped-plan/to-ped';
import { ProposalView } from './ProposalView';

/** La proposta di un contenuto del PED nato dal Piano PED: copione, slide o fotogrammi, per chi produce e chi rivede. */
export function ProposalDialog({ content, onClose }: { content: EditorialContent | null; onClose: () => void }) {
    const post = content ? parseProposal(content.proposal) : null;
    return (
        <Dialog open={!!content && !!post} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{content?.topic}</DialogTitle>
                    <DialogDescription>{post ? `${post.format} · ${post.date} alle ${post.time}${post.angle ? ` · ${post.angle}` : ''}` : ''}</DialogDescription>
                </DialogHeader>
                {post && <ProposalView post={post} />}
            </DialogContent>
        </Dialog>
    );
}
