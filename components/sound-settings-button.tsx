'use client';

import React from 'react';
import { Volume2, VolumeX, Bell, MessageSquare, Timer } from 'lucide-react';
import { useLayoutData, SoundSettings } from '@/app/(app)/layout-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { playSound } from '@/lib/sounds';

export function SoundSettingsButton() {
    const { soundSettings, setSoundSettings } = useLayoutData();

    const handleToggle = (key: keyof SoundSettings) => {
        if (typeof soundSettings[key] === 'boolean') {
            setSoundSettings(prev => ({ ...prev, [key]: !prev[key] }));
        }
    };

    const handleVolumeChange = (value: number[]) => {
        setSoundSettings(prev => ({ ...prev, volume: value[0] }));
    };

    const testSound = () => {
        playSound('notification', soundSettings.volume);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9 rounded-full"
                    title="Impostazioni audio"
                >
                    {soundSettings.enabled ? (
                        <Volume2 className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                    ) : (
                        <VolumeX className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Impostazioni Audio</h4>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={testSound}
                            className="text-xs"
                        >
                            🔊 Test
                        </Button>
                    </div>

                    <Separator />

                    {/* Master toggle */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {soundSettings.enabled ? (
                                <Volume2 className="h-4 w-4 text-green-500" />
                            ) : (
                                <VolumeX className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Label htmlFor="sound-enabled" className="cursor-pointer">
                                Audio attivo
                            </Label>
                        </div>
                        <Switch
                            id="sound-enabled"
                            checked={soundSettings.enabled}
                            onCheckedChange={() => handleToggle('enabled')}
                        />
                    </div>

                    {soundSettings.enabled && (
                        <>
                            {/* Volume slider */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm text-muted-foreground">Volume</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {Math.round(soundSettings.volume * 100)}%
                                    </span>
                                </div>
                                <Slider
                                    value={[soundSettings.volume]}
                                    onValueChange={handleVolumeChange}
                                    max={1}
                                    step={0.1}
                                    className="w-full"
                                />
                            </div>

                            <Separator />

                            {/* Individual sound toggles */}
                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                                    Tipi di notifiche
                                </Label>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bell className="h-4 w-4 text-blue-500" />
                                        <Label htmlFor="notification-sound" className="cursor-pointer text-sm">
                                            Notifiche
                                        </Label>
                                    </div>
                                    <Switch
                                        id="notification-sound"
                                        checked={soundSettings.notificationSound}
                                        onCheckedChange={() => handleToggle('notificationSound')}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4 text-purple-500" />
                                        <Label htmlFor="message-sound" className="cursor-pointer text-sm">
                                            Messaggi chat
                                        </Label>
                                    </div>
                                    <Switch
                                        id="message-sound"
                                        checked={soundSettings.messageSound}
                                        onCheckedChange={() => handleToggle('messageSound')}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Timer className="h-4 w-4 text-orange-500" />
                                        <Label htmlFor="timer-sound" className="cursor-pointer text-sm">
                                            Timer Pomodoro
                                        </Label>
                                    </div>
                                    <Switch
                                        id="timer-sound"
                                        checked={soundSettings.timerSound}
                                        onCheckedChange={() => handleToggle('timerSound')}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
