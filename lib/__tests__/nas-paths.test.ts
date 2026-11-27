import { describe, it, expect } from 'vitest';
import { extractNasPaths, cardSnippet, descriptionToText, nasFolderName } from '../nas-paths';

describe('descriptionToText', () => {
    it('decodifica le entità e tiene un paragrafo per riga', () => {
        expect(descriptionToText('<p>FOTO &amp; VIDEO</p><p>Ciao&nbsp;Giada</p>')).toBe('FOTO & VIDEO\nCiao Giada');
    });
});

describe('extractNasPaths', () => {
    it('riconosce un percorso smb:// con spazi e &amp; e si ferma al testo che segue', () => {
        const d = '<p>smb://WRD-NAS._smb._tcp.local/Archivio/BRIANZA SERRAMENTI/FOTO &amp; VIDEO/FOTO/2026/11. novembre/lavori</p>';
        expect(extractNasPaths(d)).toEqual(['smb://WRD-NAS._smb._tcp.local/Archivio/BRIANZA SERRAMENTI/FOTO & VIDEO/FOTO/2026/11. novembre/lavori']);
    });

    it('riconosce il nome del NAS senza smb:// e si ferma prima di --> e del testo', () => {
        const d = "<p>qui clip girate da loro --&gt; NAS._smb._tcp.local/Archivio/GRUPPO L'AUTO/FOTO E VIDEO/VIDEO/11_NOVEMBRE/MOODBOARD/NISSAN_JUKE per il voiceover e generici --&gt; NAS._smb._tcp.local/Archivio/GRUPPO L'AUTO/FOTO E VIDEO/VIDEO/11_NOVEMBRE/GENERICI/NISSAN</p>";
        expect(extractNasPaths(d)).toEqual([
            "NAS._smb._tcp.local/Archivio/GRUPPO L'AUTO/FOTO E VIDEO/VIDEO/11_NOVEMBRE/MOODBOARD/NISSAN_JUKE",
            "NAS._smb._tcp.local/Archivio/GRUPPO L'AUTO/FOTO E VIDEO/VIDEO/11_NOVEMBRE/GENERICI/NISSAN",
        ]);
    });

    it('si ferma prima di un link http sulla stessa riga', () => {
        const d = 'qui trovi foto --> NAS._smb._tcp.local/Archivio/BRIXIA/FOTO & VIDEO/2026/11_Novembre/H7607BA-SE054W inserirei dettagli. Qua trovi descrizione: https://www.nexths.it/x';
        expect(extractNasPaths(d)).toEqual(['NAS._smb._tcp.local/Archivio/BRIXIA/FOTO & VIDEO/2026/11_Novembre/H7607BA-SE054W']);
    });

    it('non trova nulla in un testo senza percorsi', () => {
        expect(extractNasPaths('<p>Fare grafica per augurare buon natale: ig igs</p>')).toEqual([]);
    });
});

describe('cardSnippet', () => {
    it('sostituisce il percorso con il nome della cartella', () => {
        expect(cardSnippet('<p>NAS._smb._tcp.local/Archivio/QUACQUARELLI/FOTO&amp;VIDEO/2026/11_Novembre/VIDEO/GENERICI/TWINGO</p>')).toBe('NAS › TWINGO');
    });
    it('nasFolderName ignora la barra finale', () => {
        expect(nasFolderName('smb://host/a/b/')).toBe('b');
    });
});
