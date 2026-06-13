
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, CheckCircle, ListRestart, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getClients, importEditorialContents } from '@/lib/actions';
import type { Client } from '@/lib/data';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';


type ParseResult = {
    headers: string[];
    rows: string[][];
};

type FieldMapping = {
    publicationDate: string;
    topic: string;
    format: string;
    focus: string;
    copy: string;
    tags: string;
    imageUrls: string;
    facebook: string;
    linkedin: string;
    instagram: string;
    tiktok: string;
    gbp: string;
    youtube: string;
};

const requiredFields: (keyof FieldMapping)[] = ['publicationDate', 'topic'];
const fieldLabels: Record<keyof FieldMapping, string> = {
    publicationDate: 'Data Pubblicazione',
    topic: 'Topic',
    format: 'Formato',
    focus: 'Focus',
    copy: 'Copy',
    tags: 'Tags',
    imageUrls: 'Link Immagini',
    facebook: 'Facebook (1/0)',
    linkedin: 'LinkedIn (1/0)',
    instagram: 'Instagram (1/0)',
    tiktok: 'TikTok (1/0)',
    gbp: 'Google Business (1/0)',
    youtube: 'YouTube (1/0)',
};

export default function ImportEditorialPage() {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParseResult | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [step, setStep] = useState(1);
    const [isImporting, setIsImporting] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedRows, setSelectedRows] = useState<number[]>([]);


    const [fieldMapping, setFieldMapping] = useState<FieldMapping>({
        publicationDate: '', topic: '', format: '', focus: '', copy: '', tags: '',
        imageUrls: '', facebook: '', linkedin: '', instagram: '', tiktok: '', gbp: '', youtube: ''
    });

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/csv': ['.csv'] },
        multiple: false,
    });

    useEffect(() => {
        if (parsedData) {
            setSelectedRows(parsedData.rows.map((_, index) => index));
        }
    }, [parsedData]);


    const handleParse = async () => {
        if (!file) {
            toast.error("Per favore, seleziona un file CSV.");
            return;
        }
        setIsParsing(true);
        try {
            const text = await file.text();
            // Simple CSV parser
            const allLines = text.split(/\r\n|\n/);
            const headers = allLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const rows = allLines.slice(1).filter(line => line.trim() !== '').map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')));

            setParsedData({ headers, rows });
            const fetchedClients = await getClients();
            setClients(fetchedClients);
            setStep(2);
        } catch (error) {
            toast.error('Errore nel parsing del file CSV.');
            console.error(error);
        } finally {
            setIsParsing(false);
        }
    };

    const handleMappingChange = (field: keyof FieldMapping, value: string) => {
        const finalValue = value === '__none__' ? '' : value;
        setFieldMapping(prev => ({ ...prev, [field]: finalValue }));
    };

    const isMappingComplete = useMemo(() => {
        return requiredFields.every(field => fieldMapping[field] !== '') && selectedClientId !== '';
    }, [fieldMapping, selectedClientId]);

    const previewData = useMemo(() => {
        if (!parsedData) return [];

        return parsedData.rows.map(row => {
            const mappedRow: any = { clientId: selectedClientId };
            (Object.keys(fieldMapping) as (keyof FieldMapping)[]).forEach(field => {
                const header = fieldMapping[field];
                const colIndex = parsedData.headers.indexOf(header);
                if (colIndex !== -1) {
                    let value = row[colIndex];
                    if (['facebook', 'linkedin', 'instagram', 'tiktok', 'gbp', 'youtube'].includes(field)) {
                        mappedRow[field] = value === '1' || value.toLowerCase() === 'true';
                    } else {
                        mappedRow[field] = value;
                    }
                }
            });
            return mappedRow;
        });
    }, [parsedData, fieldMapping, selectedClientId]);

    const handleImport = async () => {
        if (!parsedData || !isMappingComplete || selectedRows.length === 0) return;
        setIsImporting(true);

        const contentsToImport = selectedRows.map(rowIndex => {
            const row = parsedData.rows[rowIndex];
            const mappedRow: any = { status: 'Bozza', clientId: selectedClientId }; // Default status
            (Object.keys(fieldMapping) as (keyof FieldMapping)[]).forEach(field => {
                const header = fieldMapping[field];
                if (header) {
                    const colIndex = parsedData.headers.indexOf(header);
                    if (colIndex !== -1 && row[colIndex] !== undefined) {
                        let value = row[colIndex];
                        if (['facebook', 'linkedin', 'instagram', 'tiktok', 'gbp', 'youtube'].includes(field)) {
                            mappedRow[field] = value === '1' || value.toLowerCase() === 'true';
                        } else if (field === 'imageUrls' || field === 'tags') {
                            mappedRow[field] = value ? value.split(';').map(s => s.trim()) : [];
                        }
                        else {
                            mappedRow[field] = value;
                        }
                    }
                }
            });
            // Ensure required fields are present
            if (mappedRow.publicationDate && mappedRow.clientId && mappedRow.topic) {
                return mappedRow;
            }
            return null;
        }).filter(Boolean);

        if (contentsToImport.length === 0) {
            toast.error("Nessun dato valido da importare. Controlla la mappatura e i dati nel file.");
            setIsImporting(false);
            return;
        }

        try {
            await importEditorialContents(contentsToImport);
            toast.success(`${contentsToImport.length} contenuti importati con successo!`);
            resetState();
        } catch (error) {
            console.error(error);
            toast.error("Si è verificato un errore durante l'importazione.");
        } finally {
            setIsImporting(false);
        }
    };

    const resetState = () => {
        setFile(null);
        setParsedData(null);
        setStep(1);
        setSelectedClientId('');
        setSelectedRows([]);
        setFieldMapping({
            publicationDate: '', topic: '', format: '', focus: '', copy: '', tags: '',
            imageUrls: '', facebook: '', linkedin: '', instagram: '', tiktok: '', gbp: '', youtube: ''
        });
    }

    const selectedClientForPreview = useMemo(() => {
        return clients.find(c => c.id === selectedClientId);
    }, [clients, selectedClientId]);

    const handleSelectAllRows = (checked: boolean) => {
        if (checked && parsedData) {
            setSelectedRows(parsedData.rows.map((_, i) => i));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (index: number, checked: boolean) => {
        if (checked) {
            setSelectedRows(prev => [...prev, index]);
        } else {
            setSelectedRows(prev => prev.filter(i => i !== index));
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold font-headline">Importa Piano Editoriale da File CSV</h1>

            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Passo 1: Carica il tuo file CSV</CardTitle>
                        <CardDescription>
                            Trascina il tuo file CSV qui, o clicca per selezionarlo. Assicurati che la prima riga contenga le intestazioni delle colonne.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div
                            {...getRootProps()}
                            className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                                }`}
                        >
                            <input {...getInputProps()} />
                            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                            {isDragActive ? (
                                <p className="text-lg font-semibold">Rilascia il file qui...</p>
                            ) : (
                                <>
                                    <p className="text-lg font-semibold">Trascina il file CSV qui, o clicca per selezionare</p>
                                    <p className="text-sm text-muted-foreground">Assicurati che la prima riga contenga le intestazioni delle colonne.</p>
                                </>
                            )}
                        </div>

                        {file && (
                            <div className="p-3 border rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                                    <span className="font-medium">{file.name}</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setFile(null)}>Rimuovi</Button>
                            </div>
                        )}

                        <Button onClick={handleParse} disabled={isParsing || !file}>
                            {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Analizza File
                        </Button>
                    </CardContent>
                </Card>
            )}

            {step === 2 && parsedData && (
                <Card>
                    <CardHeader>
                        <CardTitle>Passo 2: Mappatura dei Campi</CardTitle>
                        <CardDescription>Associa le colonne del tuo file CSV ai campi del piano editoriale e seleziona il cliente per l'importazione.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div className="p-4 border rounded-lg bg-secondary/50">
                                <Label htmlFor="selected-client" className="text-base font-semibold">Seleziona Cliente</Label>
                                <p className="text-sm text-muted-foreground mb-2">Tutti i contenuti importati verranno associati a questo cliente.</p>
                                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                    <SelectTrigger id="selected-client" className="w-full md:w-1/2"><SelectValue placeholder="Seleziona un cliente..." /></SelectTrigger>
                                    <SelectContent>
                                        {[...clients].sort((a, b) => a.name.localeCompare(b.name, 'it')).map(client => (
                                            <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {(Object.keys(fieldMapping) as (keyof FieldMapping)[]).map(field => (
                                    <div key={field} className="space-y-2">
                                        <Label htmlFor={field} className="flex items-center gap-2">
                                            {fieldLabels[field]}
                                            {requiredFields.includes(field) && <span className="text-destructive font-bold">*</span>}
                                        </Label>
                                        <Select value={fieldMapping[field] || '__none__'} onValueChange={(value) => handleMappingChange(field, value)}>
                                            <SelectTrigger id={field}><SelectValue placeholder="Seleziona colonna..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">-- Non importare --</SelectItem>
                                                {parsedData.headers.map(header => (
                                                    <SelectItem key={header} value={header}>{header}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-6 flex justify-between items-center">
                            <Button variant="ghost" onClick={resetState}><ListRestart className="mr-2 h-4 w-4" />Ricomincia</Button>
                            <Button onClick={() => setStep(3)} disabled={!isMappingComplete}>
                                {isMappingComplete ? 'Vai all\'Anteprima' : 'Completa i campi obbligatori'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 3 && previewData && (
                <Card>
                    <CardHeader>
                        <CardTitle>Passo 3: Anteprima e Conferma</CardTitle>
                        <CardDescription>
                            Seleziona le righe che vuoi importare. Tutti i contenuti verranno importati per il cliente: <span className="font-bold text-primary">{selectedClientForPreview?.name}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <Checkbox
                                                checked={selectedRows.length === parsedData?.rows.length}
                                                onCheckedChange={(checked) => handleSelectAllRows(!!checked)}
                                                aria-label="Seleziona tutte le righe"
                                            />
                                        </TableHead>
                                        {parsedData?.headers.map((header, index) => (
                                            <TableHead key={`${header}-${index}`}>{header}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData.map((row, rowIndex) => (
                                        <TableRow key={rowIndex}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedRows.includes(rowIndex)}
                                                    onCheckedChange={(checked) => handleSelectRow(rowIndex, !!checked)}
                                                    aria-label={`Seleziona riga ${rowIndex + 1}`}
                                                />
                                            </TableCell>
                                            {parsedData?.headers.map((header, colIndex) => {
                                                const mappedField = (Object.keys(fieldMapping) as (keyof FieldMapping)[]).find(f => fieldMapping[f] === header);
                                                const cellValue = mappedField ? row[mappedField] : '-';

                                                return (
                                                    <TableCell key={`${rowIndex}-${colIndex}`} className="max-w-[200px] truncate">
                                                        {typeof cellValue === 'boolean' ? (cellValue ? <CheckCircle className="text-green-500" /> : null) : (cellValue || '-')}
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-6 flex justify-between items-center">
                            <Button variant="ghost" onClick={() => setStep(2)}>Torna alla Mappatura</Button>
                            <Button onClick={handleImport} disabled={isImporting || selectedRows.length === 0}>
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Conferma e Importa {selectedRows.length} Contenuti
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}
