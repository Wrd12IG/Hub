const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error("serviceAccountKey.json not found!");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Sectors mapping to help structure categories/sectors beautifully
const CLIENT_SECTORS = {
  "GAVAZZI": { sector: "Industria", url: "https://www.gavazzispa.it", description: "Produzione di reti e tessuti tecnici in fibra di vetro." },
  "WRDIGITAL": { sector: "Digital Agency", url: "https://www.wrdigital.it", description: "La nostra agenzia di digital marketing e sviluppo tecnologico." },
  "ELETTROMECCANICA FBS": { sector: "Industria", url: "https://www.elettromeccanicafbs.it", description: "Lavorazioni elettromeccaniche e avvolgimenti elettrici industriali." },
  "MOOD ARREDAMENTI": { sector: "Retail & Design", url: "https://www.moodarredamenti.it", description: "Showroom e progettazione di arredamenti d'interni su misura." },
  "MEDIAWARE": { sector: "Tech & IT", url: "https://www.mediaware.it", description: "Soluzioni IT, hardware e software per aziende e professionisti." },
  "MEDICAL - PARAFARMACIA": { sector: "Medical & Health", url: "", description: "Parafarmacia e prodotti per la salute e il benessere." },
  "ATEL MILANO": { sector: "Retail & Fashion", url: "https://www.atelmilano.it", description: "Atelier di alta moda e sartoria a Milano." },
  "YASHI ITALIA": { sector: "Tech & IT", url: "https://www.yashiweb.it", description: "Produttore di computer, monitor e soluzioni tecnologiche innovative." },
  "EUROPEA AUTO SUZUKI": { sector: "Automotive", url: "https://www.europeaauto.it", description: "Concessionaria ufficiale Suzuki per Monza e provincia." },
  "DALMA FOR YOU": { sector: "Retail & Luxury", url: "https://www.dalmaforyou.com", description: "Gioielli e accessori moda dal design esclusivo." },
  "BIKE HOUSE": { sector: "Retail & Sport", url: "https://www.bikehouse.it", description: "Concessionaria e officina specializzata per moto BMW e biciclette." },
  "MANGIAFUOCO RISTORANTE": { sector: "Food & Beverage", url: "https://www.mangiafuocomilano.it", description: "Ristorante e bistrot nel cuore di Milano." },
  "LA BUSSOLA ON THE ROAD": { sector: "Food & Beverage", url: "https://www.labussolaontheroad.it", description: "Servizio di ristorazione mobile e catering per eventi." },
  "YEPPON": { sector: "E-commerce", url: "https://www.yeppon.it", description: "Uno dei principali e-commerce italiani di elettronica consumer." },
  "AUTOSTRIATTO SRL": { sector: "Automotive", url: "https://www.autostriatto.it", description: "Concessionaria multimarca ed officina specializzata in auto usate." },
  "B2VIBE": { sector: "E-commerce", url: "https://www.b2vibe.it", description: "Store online di abbigliamento e accessori streetwear di tendenza." },
  "ARZUFFI PVD S.R.L.": { sector: "Industria", url: "https://www.arzuffipvd.it", description: "Leader mondiale nei processi di metallizzazione sotto vuoto (PVD)." },
  "COSMETIK": { sector: "Beauty & Wellness", url: "https://www.cosmetik.it", description: "Distribuzione e vendita di prodotti cosmetici professionali." },
  "BAOLI EMEA S.P.A.": { sector: "Logistica & Industria", url: "https://www.baoli-emea.com", description: "Produttore internazionale di carrelli elevatori e macchine da magazzino." },
  "QUACQUARELLI": { sector: "Servizi Professionali", url: "https://www.quacquarelli.it", description: "Studio associato di consulenza fiscale, tributaria e del lavoro." },
  "OVERING": { sector: "Tech & IT", url: "https://www.overing.it", description: "Soluzioni cloud, hosting professionale e infrastruttura di rete." },
  "SIDE STUDIO SRL": { sector: "Digital Agency", url: "https://www.sidestudio.it", description: "Studio di produzione video e contenuti multimediali." },
  "BRIXIA COMPUTER STORE": { sector: "Tech & IT", url: "https://www.brixiacomputer.it", description: "Vendita e assistenza informatica per privati e aziende a Brescia." },
  "DALLA LONGA": { sector: "Industria", url: "https://www.dallalonga.it", description: "Progettazione e produzione di serramenti e carpenteria metallica." },
  "MARTIGNONI": { sector: "Industria", url: "https://www.martignonisrl.it", description: "Lavorazioni meccaniche di precisione e costruzione stampi." },
  "SAOMEC": { sector: "Industria", url: "https://www.saomec.it", description: "Fonderia e lavorazione di metalli non ferrosi ad alta precisione." },
  "BETTIN - BGF SRL": { sector: "Industria & Logistica", url: "https://www.bettin.it", description: "Noleggio gru, piattaforme aeree e trasporti eccezionali industriali." },
  "FURECO ": { sector: "Industria & Moda", url: "https://www.fureco.it", description: "Trattamento, lavorazione e nobilitazione di pelli e pellicce per l'alta moda." },
  "BRIANZA SERRAMENTI": { sector: "Industria", url: "https://www.brianzaserramenti.it", description: "Produzione e installazione serramenti in alluminio, PVC e legno." },
  "BREVI": { sector: "Tech & IT", url: "https://www.brevi.it", description: "Uno dei principali distributori all'ingrosso di tecnologia in Italia." },
  "IMPRESA EDILE SPARTAK": { sector: "Edilizia", url: "", description: "Costruzioni, ristrutturazioni edili civili ed industriali." },
  "OSTARIA ALLA TORRE": { sector: "Food & Beverage", url: "https://www.ostariaallatorre.it", description: "Ristorante tipico veneto con cucina tradizionale rivisitata." },
  "OTTICA DEL CENTRO": { sector: "Retail & Health", url: "https://www.otticadelcentro.it", description: "Centro ottico specializzato in lenti progressive ed esame della vista." },
  "YAMAHA MOTORTIMES": { sector: "Automotive & Moto", url: "https://www.yamaha-motortimes.it", description: "Concessionario ufficiale e officina autorizzata Yamaha per la Brianza." },
  "LUCA E ANDREA BAR": { sector: "Food & Beverage", url: "", description: "Caffetteria, aperitivi e ristorazione veloce di qualità." },
  "WINBLU": { sector: "Tech & IT", url: "https://www.winblu.it", description: "Brand italiano produttore di PC desktop professionali e da gaming." },
  "MECHREVO": { sector: "Tech & IT", url: "https://www.mechrevo.it", description: "Notebook ad alte prestazioni per creator e gamer." },
  "PLATO HOLDING": { sector: "Servizi Professionali", url: "https://www.platoholding.it", description: "Società di partecipazioni e consulenza strategica aziendale." },
  "CA BELA": { sector: "Food & Beverage", url: "https://www.cabela.it", description: "Produzione artigianale e vendita di specialità gastronomiche locali." },
  "MIMMO DORMIO S.R.L. - HELP COMPUTER": { sector: "Tech & IT", url: "https://www.mimmodormio.it", description: "Vendita hardware, software e soluzioni IT gestite." },
  "MEDICAL SPA - AMBULATORIO": { sector: "Medical & Health", url: "", description: "Poliambulatorio specialistico e centro per la salute." },
  "EURO PC": { sector: "Tech & IT", url: "https://www.europc.it", description: "Vendita e noleggio di PC e attrezzature IT rigenerate per aziende." },
  "AUTOFORMULA": { sector: "Automotive", url: "https://www.autoformula.it", description: "Concessionaria ufficiale e officina autorizzata per diversi brand auto." },
  "ATLANTIS": { sector: "Retail & Sport", url: "https://www.atlantissport.it", description: "Centro sportivo e vendita di articoli sportivi professionali." },
  "ROVI": { sector: "Retail & Wedding", url: "https://www.rovisposi.it", description: "Atelier storico e sartoria per abiti da sposa e sposo in Brianza." },
  "SANGALLI": { sector: "Industria", url: "https://www.sangallisrl.it", description: "Lavorazioni lamiere e carpenteria metallica leggera." },
  "CRISMATICA NETWORK": { sector: "Tech & IT", url: "https://www.crismatica.it", description: "Managed Service Provider ed esperto di cybersecurity per imprese." },
  "STUDIO AKANTUS": { sector: "Servizi Professionali", url: "https://www.studioakantus.it", description: "Studio associato di architettura, design e urbanistica." },
  "CYBERWISE": { sector: "Tech & IT", url: "https://www.cyberwise.it", description: "Consulenza avanzata per la sicurezza informatica e audit di sicurezza." },
  "CITY MOTORS": { sector: "Automotive", url: "https://www.citymotors.it", description: "Concessionaria auto multimarca e centro assistenza qualificato." }
};

const siteClientsPath = '/Volumes/WEB_DEV/wrdigital-site/data/clients.json';

async function run() {
  try {
    const snapshot = await db.collection('clients').get();
    const clients = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const hcName = data.name.trim();
      const extraData = CLIENT_SECTORS[hcName] || CLIENT_SECTORS[hcName.toUpperCase()] || { sector: "B2B & Retail", url: "", description: "" };
      
      clients.push({
        id: `client-${doc.id.toLowerCase()}`,
        name: hcName,
        url: extraData.url || "",
        description: extraData.description || `${hcName} - Servizi di digital marketing gestiti.`,
        sector: extraData.sector || "B2B & Retail",
        socials: "{}",
        showInSuccessStories: true,
        deleted: false,
        order: 99
      });
    });
    
    // Write directly to site's json
    fs.writeFileSync(siteClientsPath, JSON.stringify(clients, null, 2), 'utf8');
    console.log(`Successfully synced ${clients.length} clients to ${siteClientsPath}`);
  } catch (err) {
    console.error("Sync error:", err);
  }
  process.exit(0);
}

run();
