'use client';

import { useEffect, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Palette, Moon, Sun, Check, Save, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type ThemeMode = 'light' | 'dark' | 'system';
type ColorTheme = 'default' | 'ocean' | 'mountain' | 'desert' | 'ice' | 'pink' | 'yellow' | 'juventus' | 'glass' | 'audi' | 'love';

const COLOR_THEMES: { id: ColorTheme; name: string; color: string; description: string }[] = [
    { id: 'default', name: 'Default', color: 'bg-blue-500', description: 'Il tema standard W[r]Digital' },
    { id: 'ocean', name: 'Ocean', color: 'bg-cyan-500', description: 'Sfumature blu profondo dell\'oceano' },
    { id: 'mountain', name: 'Mountain', color: 'bg-emerald-600', description: 'Tonalità verde montagna' },
    { id: 'desert', name: 'Desert', color: 'bg-amber-500', description: 'Colori caldi del deserto' },
    { id: 'ice', name: 'Ice', color: 'bg-sky-300', description: 'Toni freddi ghiaccio' },
    { id: 'pink', name: 'Pink', color: 'bg-pink-500', description: 'Rosa elegante e vivace' },
    { id: 'yellow', name: 'Yellow', color: 'bg-amber-500', description: 'Giallo solare ed energico ☀️' },
    { id: 'juventus', name: 'Juventus', color: 'bg-gradient-to-r from-black to-white', description: 'Bianconero fino alla fine ⚫⚪' },
    { id: 'glass', name: 'Glass', color: 'bg-gradient-to-br from-slate-200 to-slate-100 border-2 border-slate-300', description: 'Effetto vetro e trasparenze ✨' },
    { id: 'audi', name: 'Audi', color: 'bg-gradient-to-r from-black to-red-600', description: 'Vorsprung durch Technik 🏎️' },
    { id: 'love', name: 'Love', color: 'bg-gradient-to-r from-red-500 to-pink-500', description: 'Romantico e passionale ❤️' },
];

export function ThemeSelector() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [colorTheme, setColorTheme] = useState<ColorTheme>('default');
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [customBackground, setCustomBackground] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Evita hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Load saved color theme preference and apply it
    useEffect(() => {
        const savedColor = localStorage.getItem('color-theme') as ColorTheme | null;
        if (savedColor) {
            setColorTheme(savedColor);
            applyColorTheme(savedColor);
        }
        // Load custom background
        const savedBg = localStorage.getItem(`custom-bg-${savedColor || 'default'}`);
        if (savedBg) {
            setCustomBackground(savedBg);
            applyCustomBackground(savedBg);
        }
    }, []);

    const applyColorTheme = (color: ColorTheme) => {
        const root = document.documentElement;

        // Remove all color theme classes
        COLOR_THEMES.forEach(t => {
            root.classList.remove(`theme-${t.id}`);
        });

        // Apply color theme (if not default)
        if (color !== 'default') {
            root.classList.add(`theme-${color}`);
        }

        // Load custom background for this theme
        const savedBg = localStorage.getItem(`custom-bg-${color}`);
        if (savedBg) {
            setCustomBackground(savedBg);
            applyCustomBackground(savedBg);
        } else {
            setCustomBackground(null);
            removeCustomBackground();
        }
    };

    const applyCustomBackground = (imageData: string) => {
        document.body.classList.add('custom-bg');
        document.body.style.setProperty('background-image', `url(${imageData})`, 'important');
        document.body.style.setProperty('background-size', 'cover', 'important');
        document.body.style.setProperty('background-position', 'center', 'important');
        document.body.style.setProperty('background-attachment', 'fixed', 'important');
        document.body.style.setProperty('background-repeat', 'no-repeat', 'important');
    };

    const removeCustomBackground = () => {
        document.body.classList.remove('custom-bg');
        document.body.style.removeProperty('background-image');
        document.body.style.removeProperty('background-size');
        document.body.style.removeProperty('background-position');
        document.body.style.removeProperty('background-attachment');
        document.body.style.removeProperty('background-repeat');
    };

    const handleModeChange = (mode: ThemeMode) => {
        setTheme(mode);
    };

    const handleColorChange = (color: ColorTheme) => {
        setColorTheme(color);
        localStorage.setItem('color-theme', color);
        applyColorTheme(color);
        window.dispatchEvent(new CustomEvent('color-theme-change', { detail: color }));

        // Messaggio speciale per il tema Juventus + audio
        if (color === 'juventus') {
            toast.success('⚫⚪ #FinoAllaFine', {
                description: 'Benvenuto nel tema Bianconero!',
                duration: 5000,
            });

            // Play Juve anthem (full song)
            try {
                const audio = new Audio('/assets/Storia Di Un Grande Amore.mp3');
                audio.volume = 0.5;
                audio.play();
            } catch (e) {
                console.error('Error playing Juve anthem:', e);
            }
        }

        // Messaggio per il tema Audi
        if (color === 'audi') {
            toast.success('🏎️ Vorsprung durch Technik', {
                description: 'Tema Audi Premium attivato!',
                duration: 3000,
            });
        }

        // Messaggio per il tema Love con cuori che cadono
        if (color === 'love') {
            toast.success('❤️ Love is in the air!', {
                description: 'Tema romantico attivato!',
                duration: 4000,
            });

            // Crea cuori che cadono
            const createHeart = () => {
                const heart = document.createElement('div');
                heart.innerHTML = ['❤️', '💕', '💖', '💗', '💓', '💘', '💝'][Math.floor(Math.random() * 7)];
                heart.className = 'falling-heart';
                heart.style.left = Math.random() * 100 + 'vw';
                heart.style.animationDuration = (Math.random() * 2 + 3) + 's';
                heart.style.opacity = (Math.random() * 0.5 + 0.5).toString();
                heart.style.fontSize = (Math.random() * 20 + 20) + 'px';
                document.body.appendChild(heart);
                setTimeout(() => heart.remove(), 5000);
            };

            // Crea 20 cuori
            for (let i = 0; i < 20; i++) {
                setTimeout(createHeart, i * 150);
            }
        }
    };

    // Compress image using canvas
    const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.7): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Resize if larger than maxWidth
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // Convert to JPEG with compression
                    const compressedData = canvas.toDataURL('image/jpeg', quality);
                    resolve(compressedData);
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Seleziona un file immagine');
            return;
        }

        // Max 10MB original (will be compressed)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('L\'immagine deve essere inferiore a 10MB');
            return;
        }

        toast.info('Compressione immagine in corso...');

        try {
            // Compress the image
            const compressedImage = await compressImage(file);

            // Clear old backgrounds to free space
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('custom-bg-') && key !== `custom-bg-${colorTheme}`) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Save compressed image
            localStorage.setItem(`custom-bg-${colorTheme}`, compressedImage);
            setCustomBackground(compressedImage);
            applyCustomBackground(compressedImage);
            toast.success('Sfondo personalizzato applicato!');
        } catch (error) {
            console.error('Background upload error:', error);
            toast.error('Errore nel salvare l\'immagine. Prova con un\'immagine più piccola.');
        }
    };

    const handleRemoveBackground = () => {
        setCustomBackground(null);
        localStorage.removeItem(`custom-bg-${colorTheme}`);
        removeCustomBackground();
        // Re-apply theme CSS to restore default background
        applyColorTheme(colorTheme);
        toast.success('Sfondo rimosso');
    };

    // Non renderizzare nulla finché non è montato (evita hydration mismatch)
    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="relative">
                <Palette className="h-5 w-5" />
                <span className="sr-only">Personalizza tema</span>
            </Button>
        );
    }

    const currentMode = theme as ThemeMode || 'system';

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Palette className="h-5 w-5" />
                    <span className="sr-only">Personalizza tema</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Personalizza Tema
                    </DialogTitle>
                    <DialogDescription>
                        Scegli la modalità di visualizzazione e il tema colore che preferisci.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh] pr-4">
                    <div className="space-y-6 py-4">
                        {/* Mode Selector */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Modalità</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={currentMode === 'light' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => handleModeChange('light')}
                                >
                                    <Sun className="h-4 w-4" />
                                    Chiaro
                                </Button>
                                <Button
                                    variant={currentMode === 'dark' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => handleModeChange('dark')}
                                >
                                    <Moon className="h-4 w-4" />
                                    Scuro
                                </Button>
                                <Button
                                    variant={currentMode === 'system' ? 'default' : 'outline'}
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => handleModeChange('system')}
                                >
                                    Auto
                                </Button>
                            </div>
                        </div>

                        {/* Color Theme Grid */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Tema Colore</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {COLOR_THEMES.map((theme) => (
                                    <button
                                        key={theme.id}
                                        onClick={() => handleColorChange(theme.id)}
                                        className={cn(
                                            "relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                                            "hover:bg-muted/50",
                                            colorTheme === theme.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center",
                                            theme.color
                                        )}>
                                            {colorTheme === theme.id && (
                                                <Check className="h-4 w-4 text-white" />
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-sm">{theme.name}</p>
                                            <p className="text-xs text-muted-foreground">{theme.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Background Upload */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium flex items-center gap-2">
                                <ImageIcon className="h-4 w-4" />
                                Sfondo Personalizzato
                            </Label>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleBackgroundUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-2"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-4 w-4" />
                                    Carica Immagine
                                </Button>
                                {customBackground && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="gap-2"
                                        onClick={handleRemoveBackground}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Rimuovi
                                    </Button>
                                )}
                            </div>
                            {customBackground && (
                                <div className="rounded-lg border overflow-hidden">
                                    <img
                                        src={customBackground}
                                        alt="Sfondo personalizzato"
                                        className="w-full h-20 object-cover"
                                    />
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Carica un&apos;immagine di sfondo (verrà compressa automaticamente). Max 10MB.
                            </p>
                        </div>

                        {/* Preview */}
                        <div className="rounded-lg border p-4 bg-card">
                            <p className="text-sm font-medium mb-2">Anteprima</p>
                            <div className="flex gap-2">
                                <div className="h-6 w-6 rounded bg-primary" title="Primary" />
                                <div className="h-6 w-6 rounded bg-secondary" title="Secondary" />
                                <div className="h-6 w-6 rounded bg-accent" title="Accent" />
                                <div className="h-6 w-6 rounded bg-muted" title="Muted" />
                                <div className="h-6 w-6 rounded bg-destructive" title="Destructive" />
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* Auto-save indicator */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t text-sm text-muted-foreground">
                    <Save className="h-4 w-4" />
                    <span>Le modifiche vengono salvate automaticamente</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
