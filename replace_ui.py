import re

file_path = '/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/(app)/editorial-plan/client.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Trova l'inizio del return di FormWrapper
start_marker = "    return (\n        <form ref={formRef}"
end_marker = "        </form>\n    );\n}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker) - 2 # -2 to keep the closing brace

if start_idx == -1 or end_idx < start_idx:
    print("Error: Could not find FormWrapper return block")
    exit(1)

new_ui = """    return (
        <form ref={formRef} onSubmit={handleFormSubmit} className="pt-2 h-full flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 items-start max-h-[80vh] overflow-hidden">
                
                {/* SINISTRA: FORM DI INPUT */}
                <div className="flex flex-col h-full bg-white rounded-xl border overflow-hidden shadow-sm">
                    {/* Header: Canali e Strumenti */}
                    <div className="flex items-center justify-between p-3 border-b bg-muted/10">
                        <div className="flex items-center gap-2">
                            {/* Platform Toggles */}
                            <TooltipProvider>
                                {Object.entries(socialIcons).map(([key, { icon: Icon, color }]) => {
                                    const isActive = platforms[key as keyof typeof platforms];
                                    return (
                                        <Tooltip key={key}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    onClick={() => handlePlatformChange(key as keyof typeof platforms)(!isActive)}
                                                    className={cn(
                                                        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                                        isActive ? "text-white" : "text-muted-foreground bg-muted hover:bg-muted/80"
                                                    )}
                                                    style={{ backgroundColor: isActive ? color : undefined }}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>{key.charAt(0).toUpperCase() + key.slice(1)}</TooltipContent>
                                        </Tooltip>
                                    )
                                })}
                            </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedClientId ? (
                                <Link href={`/clients/${selectedClientId}/stories/new`}>
                                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 hover:text-pink-800">
                                        <Wand2 className="h-3.5 w-3.5" />
                                        <span className="text-xs">Editor Stories</span>
                                    </Button>
                                </Link>
                            ) : (
                                <Button type="button" variant="outline" size="sm" className="h-8 gap-1 border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100 hover:text-pink-800" onClick={() => toast.error("Seleziona prima un cliente nelle preimpostazioni globali per accedere all'editor.")}>
                                    <Wand2 className="h-3.5 w-3.5" />
                                    <span className="text-xs">Editor Stories</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Textarea Principale */}
                    <div className="flex-1 flex flex-col p-4">
                        <textarea
                            name="copy"
                            value={copy}
                            onChange={e => setCopy(e.target.value)}
                            placeholder="A cosa stai pensando?"
                            className="flex-1 w-full resize-none border-none focus:ring-0 text-base placeholder:text-muted-foreground p-0 min-h-[200px]"
                        />
                        
                        {/* Immagini Caricate (Thumbnails) */}
                        <div className="flex flex-wrap gap-2 mt-4">
                            {currentImageUrls.filter(url => url.trim() !== '').map((url, index) => (
                                <div key={index} className="relative group w-16 h-16 rounded-md overflow-hidden border bg-muted">
                                    <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => setCurrentImageUrls(prev => prev.filter((_, i) => i !== index))} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                            {currentVideoUrl && currentVideoUrl.trim() !== '' && (
                                <div className="relative group w-16 h-16 rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                                    <Clapperboard className="h-6 w-6 text-muted-foreground" />
                                    <button type="button" onClick={() => setCurrentVideoUrl('')} className="absolute top-0.5 right-0.5 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Toolbar Inferiore Textarea */}
                        <div className="flex items-center justify-between pt-3 mt-3 border-t">
                            <div className="flex items-center gap-3">
                                {/* Upload Icon */}
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors">
                                                {isUploadingFiles ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                                                <input
                                                    type="file"
                                                    accept="image/*,video/*"
                                                    multiple
                                                    className="hidden"
                                                    disabled={isUploadingFiles}
                                                    onChange={async (e) => {
                                                        const allFiles = Array.from(e.target.files || []);
                                                        if (allFiles.length === 0) return;
                                                        const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
                                                        const videoFiles = allFiles.filter(f => f.type.startsWith('video/'));
                                                        setIsUploadingFiles(true);
                                                        try {
                                                            if (imageFiles.length > 0) {
                                                                const attachments = await uploadFilesAndGetAttachments(imageFiles, 'editorial-plan/images', 'anonymous');
                                                                setCurrentImageUrls(prev => [...prev, ...attachments.map(a => a.url)]);
                                                            }
                                                            if (videoFiles.length > 0) {
                                                                const attachments = await uploadFilesAndGetAttachments([videoFiles[0]], 'editorial-plan/videos', 'anonymous');
                                                                setCurrentVideoUrl(attachments[0].url);
                                                            }
                                                        } catch (error) {
                                                            toast.error('Errore durante il caricamento');
                                                        } finally {
                                                            setIsUploadingFiles(false);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </TooltipTrigger>
                                        <TooltipContent>Aggiungi foto/video</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                {/* Altre icone decorative / mockup (Smile, Map, Link, ecc.) */}
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {copy.length} / 2200 <Facebook className="inline h-3 w-3 text-blue-500 ml-1" />
                            </span>
                        </div>
                    </div>

                    {/* Preimpostazioni Globali (Collapsible) */}
                    <div className="border-t bg-muted/5 p-3">
                        <Collapsible>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between p-2 h-auto text-sm font-semibold">
                                    <div className="flex items-center gap-2">
                                        <span>⚙️ Preimpostazioni globali</span>
                                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Nuovo</Badge>
                                    </div>
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3 space-y-4 px-2 pb-2 overflow-y-auto max-h-[30vh]">
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Client (if not forced) */}
                                    {!forcedClientId && (
                                        <div className="space-y-1.5">
                                            <Label className="text-xs text-muted-foreground">Cliente</Label>
                                            <Select name="clientId" required value={selectedClientId} onValueChange={setSelectedClientId}>
                                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                                <SelectContent>
                                                    {[...clients].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {forcedClientId && <input type="hidden" name="clientId" value={forcedClientId} />}
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Topic *</Label>
                                        <Input id="topic" name="topic" value={topic} onChange={e => setTopic(e.target.value)} required className="h-8 text-sm" />
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Formato *</Label>
                                        <Select name="format" value={formatValue} onValueChange={setFormatValue} required>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                                            <SelectContent>
                                                {[...editorialFormats].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(format => (
                                                    <SelectItem key={format.id} value={format.name}>{format.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Focus</Label>
                                        <Input id="focus" name="focus" defaultValue={editingContent?.focus} className="h-8 text-sm" />
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Tag</Label>
                                        <Input id="tags" name="tags" defaultValue={editingContent?.tags} placeholder="#tag..." className="h-8 text-sm" />
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Stato</Label>
                                        <Select name="status" defaultValue={editingContent?.status || initialStatusForCreate}>
                                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Stato..." /></SelectTrigger>
                                            <SelectContent>
                                                {[...editorialStatuses].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DynamicFormFields clientId={selectedClientId} content={editingContent} editorialColumns={editorialColumns} />
                            </CollapsibleContent>
                        </Collapsible>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 border-t bg-muted/10 flex items-center justify-between mt-auto">
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleCloseModal()}>Annulla</Button>
                        <div className="flex items-center gap-2">
                            <DatePickerDialog
                                value={publicationDate}
                                onChange={setPublicationDate}
                                placeholder="Data pubbl."
                                label=""
                            />
                            <Button type="submit" size="sm" className="bg-[#2D2A3B] hover:bg-[#2D2A3B]/90 text-white" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Programma
                            </Button>
                        </div>
                    </div>
                </div>

                {/* DESTRA: ANTEPRIMA LIVE */}
                <div className="h-full bg-muted/20 rounded-xl border p-4 overflow-y-auto">
                    {Object.values(platforms).every(v => !v) && (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
                            <Eye className="h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm font-medium">Seleziona un canale per vedere l'anteprima</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-8">
                        {platforms.facebook && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">Facebook</span>
                                <LivePreview platform="FACEBOOK" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.instagram && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">Instagram</span>
                                <LivePreview platform="INSTAGRAM" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.linkedin && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">LinkedIn</span>
                                <LivePreview platform="LINKEDIN" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.igStories && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">IG Stories</span>
                                <LivePreview platform="INSTAGRAM" caption={copy} postType="STORY" mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.tiktok && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">TikTok</span>
                                <LivePreview platform="TIKTOK" caption={copy} postType="REEL" mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.youtube && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">YouTube</span>
                                <LivePreview platform="YOUTUBE" caption={copy} postType={postType === 'REEL' ? 'REEL' : 'VIDEO'} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                        {platforms.gbp && (
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground self-start uppercase tracking-wider">Google Business</span>
                                <LivePreview platform="GOOGLE_BUSINESS" caption={copy} postType={postType} mediaUrls={[...currentImageUrls, currentVideoUrl]} clientName={clientName} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );"""

updated_content = content[:start_idx] + new_ui + content[end_idx:]

with open(file_path, 'w') as f:
    f.write(updated_content)

print("UI successfully replaced.")
