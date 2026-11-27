import { describe, it, expect } from 'vitest';
import { displayAttachmentName, nameFromUrl, isGenericAttachmentName } from '../attachment-name';

describe('attachment-name', () => {
    it('tiene un nome già significativo', () => {
        expect(displayAttachmentName({ filename: 'Bozza_carosello.pdf', url: 'https://x.it/a' })).toBe('Bozza_carosello.pdf');
    });
    it('riconosce i nomi generici', () => {
        expect(isGenericAttachmentName('Link allegato')).toBe(true);
        expect(isGenericAttachmentName(' ')).toBe(true);
        expect(isGenericAttachmentName('Logo.png')).toBe(false);
    });
    it('Google Drive con id illeggibile diventa solo «Google Drive»', () => {
        expect(nameFromUrl('https://drive.google.com/drive/u/0/folders/1YpIXKTn87G2l2oLwjdn-apfra_Cq45mZ')).toBe('Google Drive');
    });
    it('un sito usa dominio e pagina', () => {
        expect(displayAttachmentName({ filename: 'Link allegato', url: 'https://www.atelsrlmilano.it/manutenzione-asciugatrice/' })).toBe('atelsrlmilano.it · manutenzione asciugatrice');
    });
    it('un file usa il suo nome, anche su Firebase Storage', () => {
        expect(nameFromUrl('https://firebasestorage.googleapis.com/v0/b/app/o/tasks%2Fabc%2FCopertina%20Natale.png?alt=media')).toBe('Copertina Natale.png');
        expect(nameFromUrl('https://esempio.it/files/listino.pdf')).toBe('listino.pdf');
    });
    it('Canva', () => {
        expect(nameFromUrl('https://www.canva.com/design/DAGabc123/edit')).toBe('Canva');
    });
});
