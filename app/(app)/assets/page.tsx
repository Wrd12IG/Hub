'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Search, Download, FileText, Image as ImageIcon, Link as LinkIcon, ExternalLink, X, Loader2, AlertCircle, Video } from 'lucide-react';
import { Client } from '@/lib/data';

// Component for handling image loading with fallback
function AssetPreview({ asset, isImg, onImageClick }: { asset: any; isImg: boolean; onImageClick: () => void }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const handleImageLoad = useCallback(() => {
        setImageLoaded(true);
        setIsLoading(false);
        setImageError(false);
    }, []);

    const handleImageError = useCallback(() => {
        setImageError(true);
        setIsLoading(false);
    }, []);

    // Check if it's a video
    const isVideo = asset.url?.match(/\.(mp4|webm|mov|avi|mkv)$/i) != null || asset.filename?.match(/\.(mp4|webm|mov|avi|mkv)$/i) != null;

    if (isVideo) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-muted/20 relative cursor-pointer" onClick={onImageClick}>
                <Video className="h-12 w-12 text-muted-foreground/50" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[10px] border-l-white border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-1" />
                    </div>
                </div>
            </div>
        );
    }

    if (isImg) {
        return (
            <div className="w-full h-full relative cursor-pointer" onClick={onImageClick}>
                {/* Loading spinner */}
                {isLoading && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* Error fallback */}
                {imageError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30 gap-2">
                        <AlertCircle className="h-8 w-8 text-destructive/50" />
                        <span className="text-xs text-muted-foreground">Impossibile caricare</span>
                    </div>
                )}

                {/* Image */}
                <img
                    src={asset.url}
                    alt={asset.filename || 'Allegato'}
                    className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    loading="lazy"
                />
            </div>
        );
    }

    return asset.documentType === 'Link' ? (
        <LinkIcon className="h-10 w-10 text-muted-foreground/50" />
    ) : (
        <FileText className="h-10 w-10 text-muted-foreground/50" />
    );
}

export default function AssetsPage() {
    const { allTasks, clients, allProjects } = useLayoutData();
    const [searchQuery, setSearchQuery] = useState('');
    const [clientFilter, setClientFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedAsset, setSelectedAsset] = useState<any>(null);

    // Extract all assets
    const allAssets = useMemo(() => {
        const assets: any[] = [];
        allTasks.forEach(task => {
            if (task.attachments && task.attachments.length > 0) {
                task.attachments.forEach((att: any) => {
                    assets.push({
                        ...att,
                        taskId: task.id,
                        taskTitle: task.title,
                        clientId: task.clientId,
                        projectId: task.projectId,
                        date: task.createdAt || task.updatedAt || new Date().toISOString()
                    });
                });
            }
        });
        return assets.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allTasks]);

    // Filter
    const filteredAssets = useMemo(() => {
        return allAssets.filter(asset => {
            const matchesSearch = (asset.filename || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.taskTitle.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesClient = clientFilter === 'all' || asset.clientId === clientFilter;

            let matchesType = true;
            if (typeFilter === 'image') matchesType = isImage(asset.url) || asset.documentType === 'Image';
            if (typeFilter === 'document') matchesType = !isImage(asset.url) && asset.documentType !== 'Link' && !isVideo(asset.url);
            if (typeFilter === 'link') matchesType = asset.documentType === 'Link';
            if (typeFilter === 'video') matchesType = isVideo(asset.url);

            return matchesSearch && matchesClient && matchesType;
        });
    }, [allAssets, searchQuery, clientFilter, typeFilter]);

    function isImage(url: string) {
        if (!url) return false;
        return url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) != null;
    }

    function isVideo(url: string) {
        if (!url) return false;
        return url.match(/\.(mp4|webm|mov|avi|mkv)$/i) != null;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Assets & Media</h1>
                    <p className="text-muted-foreground">Galleria centralizzata di tutti i file e allegati dei task.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm">
                        Totale: {filteredAssets.length}
                    </Badge>
                </div>
            </div>

            {/* Filters */}
            <Card className="rounded-xl shadow-sm">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cerca per nome file o task..."
                            className="pl-8 rounded-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <Select value={clientFilter} onValueChange={setClientFilter}>
                        <SelectTrigger className="w-full md:w-[200px] rounded-full">
                            <SelectValue placeholder="Tutti i Clienti" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti i Clienti</SelectItem>
                            {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map((c: Client) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full md:w-[150px] rounded-full">
                            <SelectValue placeholder="Tutti i Tipi" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tutti</SelectItem>
                            <SelectItem value="image">Immagini</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                            <SelectItem value="document">Documenti</SelectItem>
                            <SelectItem value="link">Link</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredAssets.map((asset, i) => {
                    const isImg = isImage(asset.url) || asset.documentType === 'Image';
                    const isVid = isVideo(asset.url);
                    const clientName = clients.find((c: Client) => c.id === asset.clientId)?.name;

                    return (
                        <div key={i} className="group relative break-inside-avoid rounded-xl border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden aspect-square flex flex-col">
                            {/* Preview */}
                            <div className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center relative">
                                <AssetPreview
                                    asset={asset}
                                    isImg={isImg || isVid}
                                    onImageClick={() => (isImg || isVid) && setSelectedAsset(asset)}
                                />

                                {/* Overlay Actions */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full" asChild>
                                        <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                            {asset.documentType === 'Link' ? <ExternalLink className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </a>
                                    </Button>
                                    {asset.documentType !== 'Link' && (
                                        <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 rounded-full" asChild>
                                            <a href={asset.url} download>
                                                <Download className="h-5 w-5" />
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Footer Info */}
                            <div className="p-3 bg-card text-xs border-t">
                                <div className="font-medium truncate" title={asset.filename}>{asset.filename || 'Senza nome'}</div>
                                <div className="text-muted-foreground truncate flex justify-between mt-1">
                                    <span>{clientName || 'N/D'}</span>
                                    <span className="opacity-50">{isVid ? 'Video' : asset.documentType}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {filteredAssets.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                    <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>Nessun asset trovato con i filtri correnti.</p>
                    <p className="text-sm mt-2">Gli allegati dei task appariranno qui.</p>
                </div>
            )}

            {/* Lightbox Dialog */}
            <Dialog open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
                    <DialogTitle className="sr-only">
                        {selectedAsset?.filename || 'Anteprima'}
                    </DialogTitle>
                    {selectedAsset && (
                        <div className="relative">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20 rounded-full"
                                onClick={() => setSelectedAsset(null)}
                            >
                                <X className="h-5 w-5" />
                            </Button>

                            {isVideo(selectedAsset.url) ? (
                                <video
                                    src={selectedAsset.url}
                                    controls
                                    autoPlay
                                    className="w-full max-h-[80vh] object-contain"
                                />
                            ) : (
                                <img
                                    src={selectedAsset.url}
                                    alt={selectedAsset.filename || 'Anteprima'}
                                    className="w-full max-h-[80vh] object-contain"
                                />
                            )}

                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                <div className="flex justify-between items-end">
                                    <div className="text-white">
                                        <p className="font-medium">{selectedAsset.filename || 'Senza nome'}</p>
                                        <p className="text-sm text-white/60">Task: {selectedAsset.taskTitle}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="secondary" asChild>
                                            <a href={selectedAsset.url} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                Apri
                                            </a>
                                        </Button>
                                        <Button size="sm" variant="secondary" asChild>
                                            <a href={selectedAsset.url} download>
                                                <Download className="h-4 w-4 mr-2" />
                                                Scarica
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper icon
function Eye({ className }: { className?: string }) {
    return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
}
