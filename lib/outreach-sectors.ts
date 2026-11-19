/**
 * lib/outreach-sectors.ts
 *
 * I settori che si possono scegliere per una ricerca di aziende (Discover), da un elenco fisso. Sono le parole che
 * Sellbird cerca (con Serper) o confronta (con OpenStreetMap), quindi in italiano e come le scriverebbe un cliente.
 *
 * Una ricerca con settori scelti usa questi AL POSTO di quelli del profilo di Sellbird, solo per quella ricerca: il
 * file di configurazione non cambia. Le aziende trovate in un altro settore entrano nell'elenco, ma il profilo resta
 * quello dei concessionari: prendono meno punti (il settore giusto ne vale 20 su 100) e, finché l'approvazione è
 * obbligatoria, nessuna email parte senza una persona che la legge. L'offerta e il testo di prodotto sono scritti per
 * i concessionari: per un altro settore vanno riletti prima di approvare.
 */
export const MAX_SECTORS = 5;

export const SECTOR_GROUPS: { group: string; sectors: string[] }[] = [
    {
        group: 'Automotive',
        sectors: [
            'Concessionario auto',
            'Autosalone',
            'Auto usate',
            'Officina meccanica',
            'Carrozzeria',
            'Gommista',
            'Noleggio auto',
            'Concessionario moto',
            'Concessionario veicoli commerciali',
            'Concessionario camper',
            'Autolavaggio',
        ],
    },
    {
        group: 'Altri settori',
        sectors: [
            'Serramenti e infissi',
            'Impresa edile',
            'Agenzia immobiliare',
            'Ristorante',
            'Studio dentistico',
            'Studio legale',
            'Studio commercialista',
            'Centro estetico',
            'Palestra',
            'Negozio di elettronica',
            'Azienda manifatturiera',
            'Software house',
        ],
    },
];

export const ALL_SECTORS: string[] = SECTOR_GROUPS.flatMap((g) => g.sectors);

export const isKnownSector = (s: string): boolean => ALL_SECTORS.includes(s);
