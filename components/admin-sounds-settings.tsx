'use client';


import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    Bell,
    MessageSquare,
    Timer,
    Upload,
    Play,
    Trash2,
    Volume2,
    Check,
    AlertCircle,
    BellRing,
    XCircle,
    ClipboardCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { clearSoundSettingsCache } from '@/lib/sounds';

// Sound types configuration
const SOUND_CATEGORIES = [
    {
        id: 'notification',
        label: 'Notifiche',
        description: 'Suono per nuove notifiche in-app',
        icon: Bell,
        color: 'text-primary',
        bgColor: 'bg-primary/10',
    },
    {
        id: 'message',
        label: 'Messaggi Chat',
        description: 'Suono per nuovi messaggi nella chat',
        icon: MessageSquare,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
    },
    {
        id: 'timer',
        label: 'Timer Pomodoro',
        description: 'Suono alla fine del timer',
        icon: Timer,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
    },
    {
        id: 'task_approval_requested',
        label: 'Richiesta Approvazione',
        description: 'Suono DING quando arriva una richiesta di approvazione',
        icon: Bell,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
    },
    {
        id: 'task_approval',
        label: 'Task Approvato',
        description: 'Suono quando un task viene approvato',
        icon: ClipboardCheck,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
    },
    {
        id: 'task_rejected',
        label: 'Task Respinto',
        description: 'Suono quando un task viene respinto',
        icon: XCircle,
        color: 'text-rose-500',
        bgColor: 'bg-rose-500/10',
    },
    {
        id: 'success',
        label: 'Successo',
        description: 'Suono per operazioni completate',
        icon: Check,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
    },
    {
        id: 'error',
        label: 'Errore',
        description: 'Suono per errori e avvisi',
        icon: AlertCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
    },
];

interface SoundConfig {
    id: string;
    customUrl?: string;
    useCustom: boolean;
    volume: number;
}

interface GlobalSoundSettings {
    sounds: Record<string, SoundConfig>;
    browserNotificationsEnabled: boolean;
    updatedAt?: string;
}

const DEFAULT_SOUND_SETTINGS: GlobalSoundSettings = {
    sounds: {
        notification: { id: 'notification', useCustom: false, volume: 0.5 },
        message: { id: 'message', useCustom: false, volume: 0.5 },
        timer: { id: 'timer', useCustom: false, volume: 0.5 },
        success: { id: 'success', useCustom: false, volume: 0.5 },
        error: { id: 'error', useCustom: false, volume: 0.5 },
        task_rejected: { id: 'task_rejected', useCustom: false, volume: 0.5 },
        task_approval: { id: 'task_approval', useCustom: false, volume: 0.5 },
        task_approval_requested: { id: 'task_approval_requested', useCustom: false, volume: 0.5 },
    },
    browserNotificationsEnabled: false,
};

export default function AdminSoundsSettings() {
    const [settings, setSettings] = useState<GlobalSoundSettings>(DEFAULT_SOUND_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadingSound, setUploadingSound] = useState<string | null>(null);
    const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

    // Load settings from Firestore
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'sounds');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as GlobalSoundSettings;

                    // Deep merge sounds to ensure new keys in DEFAULT_SOUND_SETTINGS are respected
                    // even if missing in Firestore data
                    const mergedSounds = { ...DEFAULT_SOUND_SETTINGS.sounds };
                    if (data.sounds) {
                        for (const key in data.sounds) {
                            if (Object.prototype.hasOwnProperty.call(data.sounds, key)) {
                                mergedSounds[key] = {
                                    ...mergedSounds[key],
                                    ...data.sounds[key]
                                };
                            }
                        }
                    }

                    setSettings({
                        ...DEFAULT_SOUND_SETTINGS,
                        ...data,
                        sounds: mergedSounds
                    });
                }
            } catch (error) {
                console.error('Error loading sound settings:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();

        // Check browser notification permission
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setBrowserPermission(Notification.permission);
        }
    }, []);

    // Save settings to Firestore
    const saveSettings = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(db, 'settings', 'sounds');
            await setDoc(docRef, {
                ...settings,
                updatedAt: new Date().toISOString(),
            });
            clearSoundSettingsCache(); // Clear cache so app picks up new settings immediately
            toast.success('Impostazioni suoni salvate!');
        } catch (error) {
            console.error('Error saving sound settings:', error);
            toast.error('Errore nel salvataggio delle impostazioni');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle file upload for custom sound
    const handleFileUpload = async (soundId: string, file: File) => {
        if (!file.type.startsWith('audio/')) {
            toast.error('Seleziona un file audio valido (MP3, WAV, OGG)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast.error('Il file è troppo grande (max 5MB)');
            return;
        }

        setUploadingSound(soundId);
        try {
            const storage = getStorage();
            const storageRef = ref(storage, `sounds/${soundId}_custom_${Date.now()}.${file.name.split('.').pop()}`);

            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            setSettings(prev => ({
                ...prev,
                sounds: {
                    ...prev.sounds,
                    [soundId]: {
                        ...(prev.sounds[soundId] || DEFAULT_SOUND_SETTINGS.sounds[soundId] || { id: soundId, volume: 0.5, useCustom: false }),
                        customUrl: downloadUrl,
                        useCustom: true,
                    },
                },
            }));

            toast.success(`Suono "${SOUND_CATEGORIES.find(c => c.id === soundId)?.label}" caricato!`);
        } catch (error) {
            console.error('Error uploading sound:', error);
            toast.error('Errore nel caricamento del file');
        } finally {
            setUploadingSound(null);
        }
    };

    // Remove custom sound
    const handleRemoveCustomSound = async (soundId: string) => {
        const currentUrl = settings.sounds[soundId]?.customUrl;

        if (currentUrl) {
            try {
                const storage = getStorage();
                const storageRef = ref(storage, currentUrl);
                await deleteObject(storageRef).catch(() => {
                    // File might not exist, ignore error
                });
            } catch (error) {
                console.error('Error deleting sound file:', error);
            }
        }

        setSettings(prev => ({
            ...prev,
            sounds: {
                ...prev.sounds,
                [soundId]: {
                    ...(prev.sounds[soundId] || DEFAULT_SOUND_SETTINGS.sounds[soundId] || { id: soundId, volume: 0.5, useCustom: false }),
                    customUrl: undefined,
                    useCustom: false,
                },
            },
        }));

        toast.success('Suono personalizzato rimosso');
    };

    // Play sound preview
    const playSound = (soundId: string) => {
        const soundConfig = settings.sounds[soundId];
        const url = soundConfig?.useCustom && soundConfig?.customUrl
            ? soundConfig.customUrl
            : `/sounds/${soundId}.mp3`;

        try {
            const audio = new Audio(url);
            audio.volume = soundConfig?.volume ?? 0.5;
            audio.play().catch(err => {
                console.warn('Could not play sound:', err);
                toast.error('Impossibile riprodurre il suono');
            });
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    // Update sound volume
    const updateVolume = (soundId: string, volume: number) => {
        setSettings(prev => {
            const currentSound = prev.sounds[soundId] || DEFAULT_SOUND_SETTINGS.sounds[soundId] || { id: soundId, useCustom: false, volume: 0.5 };
            return {
                ...prev,
                sounds: {
                    ...prev.sounds,
                    [soundId]: {
                        ...currentSound,
                        volume,
                    },
                },
            };
        });
    };

    // Toggle custom sound usage
    const toggleUseCustom = (soundId: string, useCustom: boolean) => {
        if (useCustom && !settings.sounds[soundId]?.customUrl) {
            toast.error('Carica prima un file audio personalizzato');
            return;
        }

        setSettings(prev => ({
            ...prev,
            sounds: {
                ...prev.sounds,
                [soundId]: {
                    ...(prev.sounds[soundId] || DEFAULT_SOUND_SETTINGS.sounds[soundId] || { id: soundId, volume: 0.5, useCustom: false }),
                    useCustom,
                },
            },
        }));
    };

    // Request browser notification permission
    const requestBrowserNotificationPermission = async () => {
        if (!('Notification' in window)) {
            toast.error('Il tuo browser non supporta le notifiche');
            return;
        }

        try {
            const permission = await Notification.requestPermission();
            setBrowserPermission(permission);

            if (permission === 'granted') {
                setSettings(prev => ({
                    ...prev,
                    browserNotificationsEnabled: true,
                }));

                // Show test notification
                new Notification('W[r]Digital Hub', {
                    body: 'Le notifiche browser sono ora attive!',
                    icon: '/favicon.ico',
                });

                toast.success('Notifiche browser attivate!');
            } else if (permission === 'denied') {
                toast.error('Permesso notifiche negato. Abilitalo dalle impostazioni del browser.');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            toast.error('Errore nella richiesta dei permessi');
        }
    };

    // Send test browser notification
    const sendTestNotification = () => {
        if (browserPermission !== 'granted') {
            requestBrowserNotificationPermission();
            return;
        }

        new Notification('Test Notifica - W[r]Digital Hub', {
            body: 'Questa è una notifica di test! 🔔',
            icon: '/favicon.ico',
            tag: 'test-notification',
        });
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
            {/* Browser Notifications Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <BellRing className="h-5 w-5 text-indigo-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Notifiche Browser Native</CardTitle>
                            <CardDescription>
                                Ricevi notifiche anche quando la tab del browser non è attiva
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="font-medium">Stato permessi:</span>
                                <span className="text-sm text-muted-foreground">
                                    {browserPermission === 'granted' && 'Notifiche attive'}
                                    {browserPermission === 'denied' && 'Notifiche bloccate'}
                                    {browserPermission === 'default' && 'Non ancora richiesto'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={browserPermission === 'granted' ? 'default' : 'secondary'}
                                className={browserPermission === 'granted' ? 'bg-green-500' : browserPermission === 'denied' ? 'bg-red-500' : ''}
                            >
                                {browserPermission === 'granted' && '✓ Attive'}
                                {browserPermission === 'denied' && '✗ Bloccate'}
                                {browserPermission === 'default' && '○ Non richiesto'}
                            </Badge>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Abilita notifiche browser</Label>
                            <p className="text-sm text-muted-foreground">
                                Mostra notifiche desktop quando arrivano nuovi messaggi
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {browserPermission !== 'granted' && (
                                <Button variant="outline" size="sm" onClick={requestBrowserNotificationPermission}>
                                    Richiedi Permesso
                                </Button>
                            )}
                            <Switch
                                checked={settings.browserNotificationsEnabled && browserPermission === 'granted'}
                                onCheckedChange={(checked) => {
                                    if (checked && browserPermission !== 'granted') {
                                        requestBrowserNotificationPermission();
                                    } else {
                                        setSettings(prev => ({ ...prev, browserNotificationsEnabled: checked }));
                                    }
                                }}
                                disabled={browserPermission === 'denied'}
                            />
                        </div>
                    </div>

                    {browserPermission === 'granted' && (
                        <Button variant="outline" size="sm" onClick={sendTestNotification}>
                            🔔 Invia Notifica di Test
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Sound Settings Section */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Volume2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Gestione Suoni</CardTitle>
                            <CardDescription>
                                Personalizza i suoni delle notifiche caricando file audio personalizzati
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {SOUND_CATEGORIES.map((category) => {
                            const soundConfig = settings.sounds[category.id] || { id: category.id, useCustom: false, volume: 0.5 };
                            const Icon = category.icon;

                            return (
                                <div key={category.id} className="p-4 rounded-xl border bg-card">
                                    <div className="flex items-start gap-4">
                                        {/* Icon and Info */}
                                        <div className={`p-3 rounded-lg ${category.bgColor}`}>
                                            <Icon className={`h-6 w-6 ${category.color}`} />
                                        </div>

                                        <div className="flex-1 space-y-4">
                                            {/* Header */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-semibold">{category.label}</h4>
                                                    <p className="text-sm text-muted-foreground">{category.description}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => playSound(category.id)}
                                                    title="Riproduci suono"
                                                >
                                                    <Play className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Volume Slider */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm">Volume</Label>
                                                    <span className="text-xs text-muted-foreground">
                                                        {Math.round(soundConfig.volume * 100)}%
                                                    </span>
                                                </div>
                                                <Slider
                                                    value={[soundConfig.volume]}
                                                    onValueChange={([value]) => updateVolume(category.id, value)}
                                                    max={1}
                                                    step={0.1}
                                                    className="w-full"
                                                />
                                            </div>

                                            <Separator />

                                            {/* Custom Sound Section */}
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-sm">Usa suono personalizzato</Label>
                                                    <Switch
                                                        checked={soundConfig.useCustom}
                                                        onCheckedChange={(checked) => toggleUseCustom(category.id, checked)}
                                                        disabled={!soundConfig.customUrl}
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="file"
                                                        accept="audio/*"
                                                        className="hidden"
                                                        ref={(el) => { fileInputRefs.current[category.id] = el; }}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(category.id, file);
                                                        }}
                                                    />

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => fileInputRefs.current[category.id]?.click()}
                                                        disabled={uploadingSound === category.id}
                                                    >
                                                        {uploadingSound === category.id ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2" />
                                                                Caricamento...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Upload className="h-3 w-3 mr-2" />
                                                                Carica Audio
                                                            </>
                                                        )}
                                                    </Button>

                                                    {soundConfig.customUrl && (
                                                        <>
                                                            <Badge variant="secondary" className="text-xs">
                                                                ✓ Personalizzato
                                                            </Badge>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                                onClick={() => handleRemoveCustomSound(category.id)}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>

                                                <p className="text-xs text-muted-foreground">
                                                    Formati supportati: MP3, WAV, OGG (max 5MB)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Separator className="my-6" />

                    <div className="flex justify-end">
                        <Button onClick={saveSettings} disabled={isSaving}>
                            {isSaving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    Salvataggio...
                                </>
                            ) : (
                                'Salva Impostazioni Suoni'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
