# Accesso API per TikTok e YouTube (pubblicazione organica)

Windsor non pubblica su TikTok né su YouTube: servono le API dirette, e **richiedono la review dell'app da parte della piattaforma** (settimane). Le richieste vanno fatte da un account della piattaforma, quindi non le può inviare l'Hub: questa è la lista di cosa serve.

## TikTok — Content Posting API
1. https://developers.tiktok.com → Manage apps → Create app (tipo *Web*), con l'organizzazione WRDigital.
2. Prodotti da aggiungere: **Login Kit** e **Content Posting API** (*Direct Post*).
3. Scope: `video.publish` (e `video.upload` per le bozze). Redirect URI: `https://hub.wrdigital.it/api/clients/<id>/tiktok/token` (route già presente).
4. Per la review servono: sito dell'app con privacy policy e termini, un video dimostrativo del flusso (login → scelta file → pubblicazione), descrizione d'uso.
5. ⚠️ Finché l'app non è approvata (audit), i post pubblicati via API sono **solo privati** (visibili solo all'autore): va bene per i test, non per i clienti.
6. Env da aggiungere su Vercel dopo l'approvazione: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.

## YouTube — Data API v3 (`videos.insert`)
1. Google Cloud, progetto `hubwrdigital` → abilita **YouTube Data API v3**.
2. Schermata di consenso OAuth: scope `https://www.googleapis.com/auth/youtube.upload`; è uno scope sensibile → serve la **verifica dell'app** (sito, privacy policy, video dimostrativo).
3. ⚠️ I video caricati da progetti API **non verificati** vengono bloccati come privati; serve l'*API Compliance Audit* di YouTube per sbloccare la pubblicazione pubblica.
4. Quota: `videos.insert` costa 1600 unità su 10.000 al giorno (≈6 video/giorno) salvo aumento richiesto.
5. Il Hub ha già le route `/api/clients/[id]/youtube/*` per collegare il canale del cliente.

## Cosa fa l'Hub nel frattempo
TikTok e YouTube compaiono come "Da pubblicare a mano" (puntino grigio) nel Piano Editoriale e non bloccano la pubblicazione degli altri canali.
