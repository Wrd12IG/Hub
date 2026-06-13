'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getCompanyCosts, updateCompanyCosts } from '@/lib/actions';
import { CompanyCosts, User } from '@/lib/data';
import { Building2, Users, Calculator, Save, Loader2, TrendingUp, Euro, Clock, Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminCompanyCostsProps {
    users: User[];
}

export default function AdminCompanyCosts({ users }: AdminCompanyCostsProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [costs, setCosts] = useState<CompanyCosts>({
        dirigenza: 0,
        struttura: 0,
        varie: 0
    });

    // Calculate billable employees (only Collaboratore and Project Manager, excluding Amministratore and Cliente)
    const activeEmployees = useMemo(() => {
        return users.filter(u =>
            (u.role === 'Collaboratore' || u.role === 'Project Manager') &&
            u.status !== 'Inattivo'
        );
    }, [users]);

    const activeEmployeesCount = activeEmployees.length;

    // Monthly work hours assumption (configurable)
    const [monthlyHours, setMonthlyHours] = useState(160);

    // Calculated values
    const calculatedValues = useMemo(() => {
        const totalMonthlyCost = (costs.dirigenza || 0) + (costs.struttura || 0) + (costs.varie || 0);
        const costPerEmployee = activeEmployeesCount > 0 ? totalMonthlyCost / activeEmployeesCount : 0;
        const hourlyOverhead = monthlyHours > 0 ? costPerEmployee / monthlyHours : 0;
        const yearlyTotal = totalMonthlyCost * 12;

        return {
            totalMonthlyCost,
            costPerEmployee,
            hourlyOverhead,
            yearlyTotal
        };
    }, [costs, activeEmployeesCount, monthlyHours]);

    // Load costs on mount
    useEffect(() => {
        const loadCosts = async () => {
            try {
                const data = await getCompanyCosts();
                if (data) {
                    setCosts({
                        dirigenza: data.dirigenza || 0,
                        struttura: data.struttura || 0,
                        varie: data.varie || 0
                    });
                }
            } catch (error) {
                console.error('Error loading company costs:', error);
                toast({
                    title: "Errore",
                    description: "Impossibile caricare i costi aziendali",
                    variant: "destructive"
                });
            } finally {
                setIsLoading(false);
            }
        };
        loadCosts();
    }, [toast]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateCompanyCosts(costs);
            toast({
                title: "Salvato",
                description: "Costi aziendali aggiornati con successo"
            });
        } catch (error) {
            console.error('Error saving company costs:', error);
            toast({
                title: "Errore",
                description: "Impossibile salvare i costi aziendali",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR'
        }).format(value);
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="p-6 flex justify-center items-center min-h-[300px]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Costi Aziendali Mensili
                    </CardTitle>
                    <CardDescription>
                        Inserisci i costi fissi mensili dell'azienda. Questi verranno ripartiti solo su Collaboratori e Project Manager
                        (esclusi Amministratori) per calcolare il costo orario effettivo nei report.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Cost Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Dirigenza */}
                        <div className="space-y-2">
                            <Label htmlFor="dirigenza" className="flex items-center gap-2">
                                <span className="text-lg">👔</span>
                                Dirigenza
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Stipendi dirigenziali, consulenze direzionali, ecc.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Label>
                            <div className="relative">
                                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="dirigenza"
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className="pl-9"
                                    value={costs.dirigenza || ''}
                                    onChange={(e) => setCosts(prev => ({
                                        ...prev,
                                        dirigenza: parseFloat(e.target.value) || 0
                                    }))}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Struttura */}
                        <div className="space-y-2">
                            <Label htmlFor="struttura" className="flex items-center gap-2">
                                <span className="text-lg">🏢</span>
                                Struttura
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Affitto, utenze, manutenzione, assicurazioni, ecc.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Label>
                            <div className="relative">
                                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="struttura"
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className="pl-9"
                                    value={costs.struttura || ''}
                                    onChange={(e) => setCosts(prev => ({
                                        ...prev,
                                        struttura: parseFloat(e.target.value) || 0
                                    }))}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Varie */}
                        <div className="space-y-2">
                            <Label htmlFor="varie" className="flex items-center gap-2">
                                <span className="text-lg">📋</span>
                                Varie
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Software, marketing, formazione, altri costi generali</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Label>
                            <div className="relative">
                                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="varie"
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    className="pl-9"
                                    value={costs.varie || ''}
                                    onChange={(e) => setCosts(prev => ({
                                        ...prev,
                                        varie: parseFloat(e.target.value) || 0
                                    }))}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Configuration */}
                    <div className="flex flex-wrap gap-6 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="monthlyHours" className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Ore lavorative mensili per dipendente
                            </Label>
                            <Input
                                id="monthlyHours"
                                type="number"
                                min={1}
                                max={250}
                                className="w-32"
                                value={monthlyHours}
                                onChange={(e) => setMonthlyHours(parseInt(e.target.value) || 160)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                                Collaboratori e PM attivi: <Badge variant="secondary">{activeEmployeesCount}</Badge>
                            </span>
                        </div>
                    </div>

                    <Separator />

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-4">
                                <div className="text-sm text-muted-foreground">Totale Mensile</div>
                                <div className="text-2xl font-bold text-primary">
                                    {formatCurrency(calculatedValues.totalMonthlyCost)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-500/5 border-blue-500/20">
                            <CardContent className="pt-4">
                                <div className="text-sm text-muted-foreground">Totale Annuale</div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {formatCurrency(calculatedValues.yearlyTotal)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-500/5 border-amber-500/20">
                            <CardContent className="pt-4">
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    Costo/Dipendente (mese)
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info className="h-3 w-3" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Costi totali ÷ {activeEmployeesCount} Collaboratori/PM</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                    {formatCurrency(calculatedValues.costPerEmployee)}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-green-500/5 border-green-500/20">
                            <CardContent className="pt-4">
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" />
                                    Sovrapprezzo Orario
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info className="h-3 w-3" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Questo importo verrà aggiunto al costo orario base di ogni dipendente nei report</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    +{formatCurrency(calculatedValues.hourlyOverhead)}/h
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Example */}
                    {activeEmployees.length > 0 && calculatedValues.hourlyOverhead > 0 && (
                        <Card className="bg-muted/50">
                            <CardContent className="pt-4">
                                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                                    <Calculator className="h-4 w-4" />
                                    Esempio di calcolo costo effettivo:
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Un dipendente con costo orario base di <strong>€25/h</strong> avrà un costo effettivo di{' '}
                                    <strong className="text-foreground">
                                        {formatCurrency(25 + calculatedValues.hourlyOverhead)}/h
                                    </strong>{' '}
                                    (€25 + €{calculatedValues.hourlyOverhead.toFixed(2)} di overhead)
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            Salva Costi Aziendali
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
