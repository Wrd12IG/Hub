# 🎮 Konami Code Easter Egg - Bukowski Mode

## Come Attivare

Premi la seguente sequenza di tasti sulla tastiera:

```
↑ ↑ ↓ ↓ ← → ← → B A
```

(Freccia Su, Freccia Su, Freccia Giù, Freccia Giù, Freccia Sinistra, Freccia Destra, Freccia Sinistra, Freccia Destra, B, A)

## Cosa Succede

Quando attivi il codice, l'app entra in **"Bukowski Mode"** con:

### 🎨 Effetti Visivi
- **Animazione di attivazione** con icone animate (birra, libro, sigaretta)
- **Filtro vintage** con effetto seppia leggero
- **Scanlines** per effetto retro
- **Indicatore permanente** in basso a destra
- **Accent color rosso** per elementi interattivi

### 🎉 Features Speciali
- **Confetti animati** quando completi un task (emoji a tema: 🍺📚🚬✍️🎭💀)
- **Citazioni Bukowski** più frequenti
- **Tema scuro** con atmosfera da scrittore maledetto
- **Effetti sonori** (se file audio presente in `/public/sounds/konami-activated.mp3`)

### 🎯 Disattivazione
Clicca sulla X nell'indicatore in basso a destra oppure ricarica la pagina.

## File Coinvolti

- `hooks/useKonamiCode.ts` - Hook per rilevare la sequenza
- `components/easter-eggs/bukowski-mode.tsx` - Componente modalità Bukowski
- `app/(app)/layout.tsx` - Integrazione nel layout principale

## Personalizzazione

### Aggiungere Suono Personalizzato
Aggiungi un file audio in `/public/sounds/konami-activated.mp3` per il feedback sonoro all'attivazione.

### Modificare la Sequenza
Modifica l'array `konamiCode` in `hooks/useKonamiCode.ts`:

```typescript
const konamiCode = [
  'ArrowUp',
  'ArrowUp',
  // ... tua sequenza personalizzata
];
```

### Cambiare Stile Bukowski Mode
Modifica gli stili in `components/easter-eggs/bukowski-mode.tsx` nella sezione `<style jsx global>`.

## Easter Eggs Futuri

Altre idee da implementare:
- Digitare "bukowski" nella search bar
- Shake del mouse per effetti speciali
- Doppio click su logo per modalità segreta
- Combinazioni tastiera per altri temi (es. "cyberpunk", "retro")

## Credits

Ispirato da:
- **Konami Code** - Il più famoso cheat code della storia dei videogiochi
- **Charles Bukowski** - Scrittore, poeta e filosofo della vita vissuta

---

**Enjoy the madness! 🍺📚**
