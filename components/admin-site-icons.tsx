'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Image as ImageIcon,
    Upload,
    Trash2,
    RefreshCw,
    Globe,
    Smartphone,
    Monitor,
    Loader2,
    Download,
    Check,
    AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Icon sizes configuration
const ICON_SIZES = [
    { size: 72, label: '72x72', description: 'Icona piccola', required: false },
    { size: 96, label: '96x96', description: 'Icona Android', required: false },
    { size: 128, label: '128x128', description: 'Icona Chrome', required: false },
    { size: 144, label: '144x144', description: 'Icona Windows', required: false },
    { size: 152, label: '152x152', description: 'Icona iOS', required: false },
    { size: 192, label: '192x192', description: 'Android PWA', required: true },
    { size: 384, label: '384x384', description: 'Splash Screen', required: false },
    { size: 512, label: '512x512', description: 'PWA principale', required: true },
];

interface IconSettings {
    favicon?: string;
    mainIcon?: string;
    customIcons: Record<string, string>;
    updatedAt?: string;
}

const DEFAULT_ICON_SETTINGS: IconSettings = {
    customIcons: {},
};

export default function AdminSiteIcons() {
    const [settings, setSettings] = useState<IconSettings>(DEFAULT_ICON_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingIcon, setUploadingIcon] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const mainIconInputRef = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);
    const iconInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // Load settings from Firestore
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'site_icons');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as IconSettings;
                    setSettings({
                        ...DEFAULT_ICON_SETTINGS,
                        ...data,
                    });
                }
            } catch (error) {
                console.error('Error loading icon settings:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, []);

    // Save settings to Firestore
    const saveSettings = async (newSettings: IconSettings) => {
        setIsSaving(true);
        try {
            const docRef = doc(db, 'settings', 'site_icons');
            await setDoc(docRef, {
                ...newSettings,
                updatedAt: new Date().toISOString(),
            });
            setSettings(newSettings);
            toast.success('Impostazioni icone salvate!');
        } catch (error) {
            console.error('Error saving icon settings:', error);
            toast.error('Errore nel salvataggio delle impostazioni');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle main icon upload (will generate all sizes)
    const handleMainIconUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Seleziona un file immagine valido (PNG, JPG, SVG)');
            return;
        }

        // Prefer PNG for best quality
        if (!file.type.includes('png')) {
            toast.warning('Per migliori risultati, usa un file PNG con sfondo trasparente');
        }

        setUploadingIcon('main');
        try {
            const storage = getStorage();

            // Upload the main icon
            const mainIconRef = ref(storage, `site_icons/main_icon_${Date.now()}.png`);
            await uploadBytes(mainIconRef, file);
            const mainIconUrl = await getDownloadURL(mainIconRef);

            // Update settings
            const newSettings = {
                ...settings,
                mainIcon: mainIconUrl,
            };
            await saveSettings(newSettings);

            toast.success('Icona principale caricata! Le icone ridimensionate verranno generate automaticamente.');
        } catch (error) {
            console.error('Error uploading main icon:', error);
            toast.error('Errore nel caricamento dell\'icona');
        } finally {
            setUploadingIcon(null);
        }
    };

    // Handle favicon upload
    const handleFaviconUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Seleziona un file immagine valido');
            return;
        }

        setUploadingIcon('favicon');
        try {
            const storage = getStorage();
            const faviconRef = ref(storage, `site_icons/favicon_${Date.now()}.${file.name.split('.').pop()}`);
            await uploadBytes(faviconRef, file);
            const faviconUrl = await getDownloadURL(faviconRef);

            const newSettings = {
                ...settings,
                favicon: faviconUrl,
            };
            await saveSettings(newSettings);

            toast.success('Favicon caricata!');
        } catch (error) {
            console.error('Error uploading favicon:', error);
            toast.error('Errore nel caricamento della favicon');
        } finally {
            setUploadingIcon(null);
        }
    };

    // Handle individual icon upload for specific size
    const handleIconUpload = async (size: number, file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Seleziona un file immagine valido');
            return;
        }

        setUploadingIcon(`icon-${size}`);
        try {
            const storage = getStorage();
            const iconRef = ref(storage, `site_icons/icon_${size}x${size}_${Date.now()}.png`);
            await uploadBytes(iconRef, file);
            const iconUrl = await getDownloadURL(iconRef);

            const newSettings = {
                ...settings,
                customIcons: {
                    ...settings.customIcons,
                    [`${size}x${size}`]: iconUrl,
                },
            };
            await saveSettings(newSettings);

            toast.success(`Icona ${size}x${size} caricata!`);
        } catch (error) {
            console.error('Error uploading icon:', error);
            toast.error('Errore nel caricamento dell\'icona');
        } finally {
            setUploadingIcon(null);
        }
    };

    // Remove custom icon
    const handleRemoveIcon = async (size: number) => {
        try {
            const newCustomIcons = { ...settings.customIcons };
            delete newCustomIcons[`${size}x${size}`];

            const newSettings = {
                ...settings,
                customIcons: newCustomIcons,
            };
            await saveSettings(newSettings);

            toast.success(`Icona ${size}x${size} rimossa`);
        } catch (error) {
            console.error('Error removing icon:', error);
            toast.error('Errore nella rimozione dell\'icona');
        }
    };

    // Get icon URL for a specific size (custom or main)
    const getIconUrl = (size: number): string | null => {
        const customIcon = settings.customIcons[`${size}x${size}`];
        if (customIcon) return customIcon;
        if (settings.mainIcon) return settings.mainIcon;
        return `/icons/Icon_${size}x${size}px.png`;
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Main Icon Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <ImageIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Icona Principale</CardTitle>
                            <CardDescription>
                                Carica un'icona principale (512x512 o superiore) che verrà usata come base
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-6">
                        {/* Preview */}
                        <div className="flex-shrink-0">
                            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/30 overflow-hidden">
                                {settings.mainIcon ? (
                                    <img
                                        src={settings.mainIcon}
                                        alt="Main Icon"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                                )}
                            </div>
                        </div>

                        {/* Upload */}
                        <div className="flex-1 space-y-3">
                            <div>
                                <Label className="text-sm font-medium">Carica Icona Principale</Label>
                                <p className="text-sm text-muted-foreground">
                                    Consigliato: PNG 512x512 con sfondo trasparente
                                </p>
                            </div>

                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={mainIconInputRef}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleMainIconUpload(file);
                                }}
                            />

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => mainIconInputRef.current?.click()}
                                    disabled={uploadingIcon === 'main'}
                                >
                                    {uploadingIcon === 'main' ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Caricamento...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4 mr-2" />
                                            Carica Icona
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Favicon Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Globe className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Favicon</CardTitle>
                            <CardDescription>
                                L'icona che appare nella tab del browser (consigliato: 32x32 o 48x48 ICO/PNG)
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-6">
                        {/* Preview */}
                        <div className="flex-shrink-0">
                            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/30 overflow-hidden">
                                {settings.favicon ? (
                                    <img
                                        src={settings.favicon}
                                        alt="Favicon"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <Globe className="h-8 w-8 text-muted-foreground/50" />
                                )}
                            </div>
                        </div>

                        {/* Upload */}
                        <div className="flex-1 space-y-3">
                            <input
                                type="file"
                                accept="image/*,.ico"
                                className="hidden"
                                ref={faviconInputRef}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFaviconUpload(file);
                                }}
                            />

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => faviconInputRef.current?.click()}
                                disabled={uploadingIcon === 'favicon'}
                            >
                                {uploadingIcon === 'favicon' ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Caricamento...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Carica Favicon
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* PWA Icons Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/10">
                            <Smartphone className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Icone PWA</CardTitle>
                            <CardDescription>
                                Icone per l'installazione come app. Puoi caricare singole dimensioni o usare l'icona principale.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {ICON_SIZES.map((iconConfig) => {
                            const iconUrl = getIconUrl(iconConfig.size);
                            const isCustom = !!settings.customIcons[`${iconConfig.size}x${iconConfig.size}`];
                            const isUploading = uploadingIcon === `icon-${iconConfig.size}`;

                            return (
                                <div
                                    key={iconConfig.size}
                                    className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        {/* Icon Preview */}
                                        <div className="relative">
                                            <div
                                                className="rounded-lg border border-muted overflow-hidden flex items-center justify-center bg-muted/20"
                                                style={{ width: Math.min(iconConfig.size, 96), height: Math.min(iconConfig.size, 96) }}
                                            >
                                                {iconUrl ? (
                                                    <img
                                                        src={iconUrl}
                                                        alt={`Icon ${iconConfig.label}`}
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                                                )}
                                            </div>
                                            {isCustom && (
                                                <Badge
                                                    variant="default"
                                                    className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 bg-green-500"
                                                >
                                                    Personalizzata
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Label */}
                                        <div className="text-center">
                                            <div className="font-medium text-sm">{iconConfig.label}</div>
                                            <div className="text-xs text-muted-foreground">{iconConfig.description}</div>
                                            {iconConfig.required && (
                                                <Badge variant="outline" className="mt-1 text-[10px]">Richiesta</Badge>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                ref={(el) => { iconInputRefs.current[iconConfig.size] = el; }}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleIconUpload(iconConfig.size, file);
                                                }}
                                            />

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => iconInputRefs.current[iconConfig.size]?.click()}
                                                disabled={isUploading}
                                                title="Carica icona personalizzata"
                                            >
                                                {isUploading ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Upload className="h-3 w-3" />
                                                )}
                                            </Button>

                                            {isCustom && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                    onClick={() => handleRemoveIcon(iconConfig.size)}
                                                    title="Rimuovi icona personalizzata"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Separator className="my-6" />

                    <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        <div className="text-sm">
                            <p className="font-medium text-amber-600 dark:text-amber-400">Nota importante</p>
                            <p className="text-muted-foreground">
                                Dopo aver caricato le icone, sarà necessario ricompilare l'applicazione e copiare
                                le nuove icone nella cartella <code className="bg-muted px-1 rounded">/public/icons/</code>
                                per applicare le modifiche alla PWA.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
