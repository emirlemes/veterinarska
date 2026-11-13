# Status implementacije — Veterinary Management System

**Datum pregleda:** 11.11.2026.  
**Status projekta:** Glavni operativni moduli su implementirani. Migracije su primijenjene na konfigurisanu testnu bazu; aplikacija prolazi testove, lint, Prisma validaciju i produkcijski build. PWA instalacija i mobilne akcije pregleda su implementirane; offline rad namjerno nije omogućen, a integracijsko testiranje poslovnih tokova ostaje otvoreno.

## Poboljšanja kontrolne table i zaliha — u toku

- Kartice kontrolne table vode u odgovarajuće module s primijenjenim filterima i poštivanjem dozvola; broj lijekova s niskom zalihom više nije ograničen na prikazanih pet upozorenja.
- Registar lijekova prikazuje tabelu s pretragom, filterima, sortiranjem, paginacijom i statistikom zaliha. Istekle serije nisu uključene u raspoloživu količinu.
- Dodavanje lijeka, detalji serija, uređivanje, postojeći prijem nove serije i korekcija otvaraju se u odvojenim modalnim prozorima. Prozori upozoravaju na nesačuvane izmjene, ne zatvaraju se tokom čuvanja i prikazuju ishod operacije.
- Dodani su kategorija, proizvođač i prodajna cijena, kao i uređivanje podataka lijeka. Migracija za ova polja primijenjena je na potvrđenu testnu bazu; status migracija i čitanje novih polja su provjereni. Primjena na produkciju nije potvrđena.
- Finansijski izvještaj prikazuje uplate za odabrani period; filter računa podržava neplaćene i djelimično plaćene račune.
- Redizajn iz nove specifikacije još nije završen: postojeći prijem istovremeno kreira seriju i povećava zalihu; nezavisno kreiranje serije i prijem u postojeću seriju nisu implementirani. Potrebna je provjera kroz prijavljenu sesiju i dovršavanje ostalih radnji. Grupni prijem, samostalno izdavanje s FEFO raspodjelom, otpis i njihovo povezivanje s naplatom još nisu implementirani. Redizajn pregleda prema novoj specifikaciji također je otvoren.
- Za buduće samostalno izdavanje korisnik je odredio da ambulanta ne izdaje lijekove s ograničenjima i da Admin ručno odobrava lijekove za izdavanje; neodobreni lijekovi moraju biti blokirani. Ovo pravilo još nije implementirano.
- Posljednja automatizirana provjera: 54 testa, lint, Prisma validacija, produkcijski build i `git diff --check` uspješno prolaze. U izolovanom prikazu s testnim podacima i simuliranim odgovorima provjereni su prozori, odbacivanje izmjena, prijem, korekcija, uređivanje i obrada greške. Ovo ne zamjenjuje provjeru poslovnih tokova i mobilnog prikaza na prijavljenoj sesiji.

## Interaktivne tabele i završavanje pregleda — u toku

- Pregledi se prikazuju u tabeli s pretragom, filterima datuma, veterinara i statusa, sortiranjem po datumu i paginacijom. Radnje zavise od statusa i dozvola.
- Pregled se može završiti iz detalja ili iz tabele uz potvrdu i ažuran sažetak. Dijagnoza je obavezna za završavanje; ista serverska provjera važi i za postojeći obrazac uređivanja.
- Završavanje pregleda, povezanog termina i audit zapisa koristi zajedničku transakcijsku logiku, bez prepisivanja kliničkih podataka pri direktnom završavanju.
- Redovi pregleda, desktop lista klijenata, životinja, računa, zaliha i finansijskog izvještaja te mobilne kartice klijenata i životinja podržavaju otvaranje detalja klikom i tastaturom; ugrađene radnje ostaju nezavisne. Ostale tabele i mobilne kartice nisu još sve prilagođene.
- Transakcijski test završavanja prošao je na testnoj bazi sa sintetičkim podacima i obaveznim rollbackom; zasebno je provjereno ponašanje prozora i redova u izolovanom pregledniku sa simuliranim API-jem. Cjelovito testiranje prijavljene aplikacije, svih tabela i mobilnih širina ostaje otvoreno.

## Sažetak dosadašnjeg rada

U dostavljenom tekstu nalazi se specifikacija MVP aplikacije za upravljanje veterinarskom ambulantom. Radni folder je bio prazan osim ovog statusnog dokumenta. U prvom implementacijskom prolazu postavljena je Next.js osnova, početna Prisma šema, konfiguracija lokalne baze, autentifikacija, RBAC i kontrolna tabla.

## Šta je definisano specifikacijom

Specifikacija predviđa MVP sa:

- **Tehnologijama:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, Zod, Prisma i PostgreSQL.
- **Prijavom i ovlastima:** Auth.js credentials autentifikacija, sigurno hashiranje lozinki, sesije i kontrola pristupa po ulogama.
- **Jezikom i lokalizacijom:** bosanski jezik (latinica), valuta BAM/KM, datum DD.MM.YYYY i 24-satni prikaz vremena.
- **Modulima:** dashboard, klijenti, životinje, termini i kalendar, pregledi i medicinski kartoni, terapije, lijekovi i zalihe, usluge i cjenovnik, računi i naplata, izvještaji, zaposleni i podešavanja.
- **Ključnim tokom rada:** klijent → životinja → termin → pregled → terapija/utrošak lijeka → račun → uplata → izvještaj.
- **Pouzdanošću:** validacija ulaza, autorizacija operacija, transakcije za kritične poslovne radnje, zaštita od negativnog stanja zaliha, sprečavanje preklapanja termina za veterinara i čuvanje historijskih podataka.
- **Provjerama:** testovi poslovnih pravila i najmanje jedan integracijski test kompletnog toka.

Ovo su zahtjevi iz specifikacije, a ne potvrda da su navedene funkcionalnosti već izrađene.

## Status po fazama

| Faza | Obuhvat | Status |
|---|---|---|
| 1. Osnova | Next.js, konfiguracija, PostgreSQL, Prisma, autentifikacija, RBAC, osnovni layout i navigacija | U toku — aplikacija validirana; dvije uloge i migracije primijenjene na Supabase |
| 2. Osnovni registri | Klijenti, životinje, zaposleni, usluge | U toku — CRUD klijenata, životinja, usluga i upravljanje zaposlenima implementirani |
| 3. Veterinarski rad | Termini, kalendar, pregledi, medicinska historija, terapije | U toku — dnevni, sedmični i mjesečni raspored, pregledi, terapije i primjena lijekova implementirani; integracijske provjere nedostaju |
| 4. Zalihe | Lijekovi, serije, kretanja zaliha, utrošak lijekova | U toku — registar lijekova, prijem serija, korekcije, transakcijski utrošak i izvještaj historije kretanja implementirani; test nad stvarnom bazom nedostaje |
| 5. Naplata | Računi, stavke računa, PDF, uplate i djelimične uplate | U toku — računi, uplate i storno uplata/računa implementirani; izmjena izdatih računa nije podržana radi očuvanja finansijske historije |
| 6. Izvještaji | Dashboard statistika, finansijski i inventurni izvještaji, CSV | U toku — finansijski i inventurni izvještaji s CSV izvozom implementirani |
| 7. Završna provjera | Seed podaci, poslovni i integracijski testovi, UX, dokumentacija, build | U toku — migracije su na Supabaseu; potrebni su integracijski testovi i provjera CRUD tokova |

## Implementirano

- Next.js App Router projekat sa TypeScriptom i Tailwind CSS-om.
- Bosanski login ekran, Auth.js Credentials prijava i odjava.
- Instalabilni PWA: manifest, Android/iOS ikone, standalone prikaz, instalacijski poziv za podržane preglednike i Safari upute za iOS. Service worker ne pohranjuje prijavljene stranice, API odgovore ni medicinske podatke; offline ekran jasno traži internet vezu.
- Obrazac pregleda je prilagođen radu jednom rukom na telefonu: polja su responsivna, a akcije za čuvanje i završetak pregleda ostaju dostupne iz fiksne donje trake iznad mobilne navigacije.
- Provjera aktivnog korisničkog računa i poređenje bcrypt hashirane lozinke.
- Dvije korisničke uloge: Admin s punim pristupom i Veterinar s punim pristupom svakodnevnim modulima; samo Admin upravlja korisnicima i sistemskim postavkama. Dozvole se provjeravaju kroz centralne RBAC helpere.
- Početna Prisma/PostgreSQL šema za korisnike, klijente, životinje i vlasničku historiju, termine, preglede, terapije, lijekove, zalihe, usluge, račune, uplate, podešavanja i audit zapise.
- Početna SQL migracija generisana i spremljena u `prisma/migrations`.
- Migracija za dvije uloge čuva postojeće Admin naloge, a stare ne-Admin uloge pretvara u Veterinar; obje Prisma migracije su primijenjene na Supabase.
- Docker Compose PostgreSQL 16 servis i `.env.example`.
- Prisma je podešen sa odvojenim `DATABASE_URL` (runtime/pooler) i `DIRECT_URL` (migracije) za podršku Supabase konekciji.
- Seed za lokalni administratorski račun i osnovna podešavanja ambulante.
- Kontrolna tabla koja čita dnevne termine, preglede, klijente, životinje, uplate, otvorene račune i zalihe iz baze.
- Registar klijenata: pretraga/paginacija, detalji, kreiranje, uređivanje i arhiviranje bez brisanja historijskih zapisa.
- Registar životinja: pretraga/paginacija, detalji, kreiranje, uređivanje i arhiviranje; promjena vlasnika evidentira vremenski period prethodnog vlasništva i kreira novi zapis u istoj transakciji.
- Historija vlasništva, termini i pregledi prikazuju se na profilu životinje; povezani računi dostupni su samo ulogama sa finansijskom dozvolom.
- Polja alergija, hroničnih stanja i medicinskih napomena zaštićena su dozvolama za medicinsko pisanje/čitanje.
- Dodani testovi validacije životinje, uključujući stvarni datum, obavezne podatke, vlasnika i pozitivnu težinu.
- Termini: dnevni raspored i filter statusa, mobilne kartice i desktop tabela, zakazivanje, statusni tok, validacija aktivnog klijenta/životinje/veterinara i sprečavanje preklapanja termina za veterinara.
- Uređivanje zakazanih i potvrđenih termina: promjena klijenta/životinje, veterinara, vremena, razloga i napomena; server ponovo provjerava radno vrijeme, aktivne zapise i konflikte, a promjene bilježi u audit log. Termin s pregledom i termini u drugim statusima nisu dostupni za uređivanje.
- Pretraga dnevnog rasporeda po pacijentu, vlasniku, veterinaru i razlogu dolaska, uz zadržavanje pretrage pri navigaciji po danima.
- Sedmični kalendar termina: sedmice počinju ponedjeljkom, navigacija prethodna/sljedeća sedmica, filtriranje po veterinaru i statusu, dnevne kartice na telefonu i sedam kolona na desktopu; koristi iste termine i vremensku zonu ambulante.
- Mjesečni kalendar termina s navigacijom po mjesecima, poravnanjem ponedjeljak–nedjelja, sažetkom termina po danu i direktnim otvaranjem dnevnog rasporeda; na telefonu prikazuje mjesečne dane kao čitljivu listu.
- Vremena termina se obrađuju u vremenskoj zoni ambulante (Europe/Sarajevo), nezavisno od vremenske zone uređaja; dodani su testovi za DST, nepostojeće lokalno vrijeme i statusne tranzicije.
- Pregledi: kreiranje iz termina ili kao walk-in dolazak, mobilni obrazac, lista s pretragom/filterom, detalji, uređivanje i završetak pregleda.
- Na aktivnom pregledu mogu se evidentirati izvršene usluge iz cjenovnika s količinom i historijskom cijenom, uz audit log; nakon završetka pregleda usluge su zaključane.
- Pri kreiranju pregleda provjeravaju se aktivnost klijenta, vlasništvo i status životinje te veterinar; pregled iz termina u istoj transakciji pokreće termin, a završetak pregleda završava povezani termin.
- Navigacija iz termina, profila klijenta i profila životinje vodi direktno na kreiranje ili postojeći pregled; detalji pregleda ostaju zaštićeni dozvolom `examinations:read`.
- Dodani su testovi validacije i tranzicije statusa pregleda. CRUD nije potvrđen nad bazom jer Supabase/lokalna baza još nije povezana.
- Terapije se mogu evidentirati i uklanjati na aktivnom pregledu, uz dozu, učestalost, trajanje i upute; zapisivanje promjena ide u audit log. Završen pregled je zaključan za izmjene, a pristup upravljanju terapijama provjerava `therapies:write`.
- Modul lijekova i zaliha omogućava unos lijekova, prijem serija, pregled stanja, minimalnih količina i isteka; promjene prijema i audit zapisi izvršavaju se zajedno.
- Ovlašteni korisnici mogu povećati ili smanjiti zalihu serije kroz korekciju s obaveznim razlogom; negativna zaliha nije dozvoljena, a kretanje i audit se čuvaju transakcijski.
- Primjena lijeka u pregledu provjerava aktivnost serije i rok trajanja, atomski umanjuje količinu samo ako je zaliha dovoljna, te u istoj transakciji čuva primjenu, kretanje zalihe i audit zapis. Pregled prikazuje istoriju primjena; završeni pregledi su zaključani.
- Dashboard i registar razlikuju fizičku zalihu od isteklih serija; istekle serije nisu ponuđene za primjenu.
- Modul naplate omogućava izdavanje računa klijentu ili završenom pregledu, stavke, količine/cijene, poresku stopu, numeraciju iz podešavanja i štampu/Save as PDF. Uplate se bilježe transakcijski; status računa prelazi kroz izdato, djelimično plaćeno i plaćeno.
- Pri izdavanju računa iz završenog pregleda stavke izvršenih usluga se predpopunjavaju s cijenom zabilježenom u trenutku izvršenja; primijenjeni lijekovi se prikazuju za ručno dodavanje jer sistem još nema definisanu prodajnu cijenu lijeka.
- Ovlašteni korisnik može stornirati djelimično ili potpuno evidentiranu uplatu uz obavezan razlog; storno ne može preći preostali iznos te uplate. Novi saldo i status računa, zapis storna i audit log ažuriraju se u istoj transakciji; historija storna prikazuje se na detaljima računa.
- Cjenovnik omogućava pregled aktivnih/arhiviranih usluga, dodavanje i uređivanje usluge i cijene te arhiviranje/reaktiviranje bez brisanja historije. Usluge se mogu izabrati kao stavke računa; server provjerava aktivni zapis i cijenu prije izdavanja.
- Administratorski modul zaposlenih omogućava kreiranje naloga, izmjenu podataka i uloge, promjenu lozinke i deaktiviranje/reaktiviranje. API ne izlaže hash lozinke, e-mail je jedinstven, vlastiti nalog se ne može deaktivirati i uvijek mora ostati najmanje jedan aktivni administrator.
- Administratorska podešavanja omogućavaju uređivanje kontaktnih podataka ambulante, poreskog identifikacionog broja, prefiksa računa, standardne porezne stope, trajanja termina i sedmičnog radnog vremena. Novi termini se provjeravaju prema rasporedu ambulante; brojač računa nije moguće ručno izmijeniti.
- Finansijski izvještaj filtrira period do 366 dana, prikazuje promet i otvorena potraživanja, uz CSV izvoz. Izvještaj i CSV su zaštićeni dozvolom `reports:financial`.
- Izvještaj zaliha prikazuje fizičko i upotrebljivo stanje, minimalne zalihe, istečene i serije koje ističu u narednih 90 dana; CSV sadrži podatke po seriji i zaštićen je dozvolom `reports:inventory`, dostupnom ulogama s pristupom zalihama.
- Historija kretanja zaliha prikazuje prijeme, primjene i korekcije s filterima po periodu, lijeku, tipu kretanja i korisniku; CSV izvoz je zaštićen istom dozvolom i ograničen je na 5000 najnovijih zapisa uz jasno navedeno ograničenje.
- Navigacija na uskim ekranima prikazuje donji meni za osnovne module; obrasci termina imaju dodirne kontrole i raspored prilagođen telefonu.
- Registar klijenata i životinja na telefonu prikazuje kartice umjesto širokih tabela; mobilna navigacija uključuje i preostale module, izvještaje i odjavu kroz meni „Više”.
- Forme za klijente i životinje, profili i zaglavlja za kreiranje/uređivanje imaju veće dodirne kontrole i vertikalni raspored na uskim ekranima. Spol životinje se prikazuje kao unesena vrijednost.
- 39 automatiziranih testova za poslovna pravila, RBAC, datume i privatnost PWA service worker-a.
- README sa lokalnim uputama.

## Nije još potvrđeno / ograničenja okruženja

- Paketi su instalirani iz lokalnog npm cachea; mrežni npm registar je i dalje nedostupan.
- Prisma migracije su primijenjene na Supabase; lokalni Docker Compose/PostgreSQL servis nije pokrenut ni testiran.
- Testovi ne pokrivaju još CRUD integraciju ni kompletan poslovni tok.
- TanStack Query migracija obuhvata liste klijenata i životinja, njihove izmjene i finansijski izvještaj. Ostali prikazi i mutacije i dalje koriste postojeće serverske upite i `fetch`; sveobuhvatna migracija nije završena niti je testirana na prijavljenoj sesiji.
- Sedmični/mjesečni kalendar, pretraga dnevnog rasporeda i uređivanje zakazanih/potvrđenih termina su implementirani. Testiranje termina nad povezanom bazom nije obavljeno. PWA je instalabilan i radi online; offline unos medicinskih podataka nije uključen.
- Nisu još napravljeni integracijski testovi koji provjeravaju transakcije životinje i vlasničke historije nad stvarnom bazom.

Responzivni prikazi su pregledani kroz kod i login ekran; zaštićeni moduli nisu vizuelno provjereni kroz prijavljenu sesiju, a fizički Android/iOS uređaji još nisu testirani.

## Preporučeni redoslijed nastavka

1. Kada npm registar bude dostupan, instalirati pakete, generisati Prisma klijent, validirati šemu i riješiti eventualne compile/lint greške.
2. Pokrenuti Docker PostgreSQL i primijeniti početnu migraciju i seed.
3. Dodati/izvršiti integracijske provjere za prijavu, klijente, vlasništvo životinja i konflikt termina.
4. Provesti integracijske provjere prijema, korekcija i utroška zaliha nad povezanom bazom.
5. Pripremiti demonstracijske podatke i provjeriti tokove upravljanja nalozima/podešavanjima nad Supabaseom.
6. Dodati integracijske testove za transakcijske tokove: termin/pregled, zalihe, račun/uplate/storno i historiju vlasništva.
7. Provjeriti role i reprezentativne CRUD tokove nad Supabaseom bez korištenja stvarnih produkcijskih podataka kao testnih.
8. Provjeriti instalaciju PWA-a i obrazac pregleda na stvarnim Android/iOS uređajima; offline unos nije dio dogovorenog načina rada.
9. Pokrenuti integracijske testove cijelog toka, lint/type-check i produkcijski build; dopunjavati ovaj dokument nakon svake završene faze.

## Važne poslovne napomene iz specifikacije

- Jedan klijent može imati više životinja; pregled i historijski finansijski zapisi moraju ostati povezani i nakon arhiviranja.
- Životinja može imati samo jednog trenutnog vlasnika, uz jednostavnu historiju promjena vlasništva.
- Termin mora provjeriti da životinja pripada izabranom klijentu i da veterinar nema drugi termin u istom vremenu.
- Pregled se može pokrenuti iz termina ili kao dolazak bez termina.
- Kalendar koristi iste zapise termina; ne uvodi se zasebna evidencija kalendarskih događaja.
- Administrativno brisanje se zamjenjuje arhiviranjem kada postoje povezani historijski podaci.
- Integracije i napredne funkcionalnosti izvan MVP-a (npr. SMS/e-mail obavijesti, portal klijenta, vanjski kalendari, naplata karticama i više poslovnica) nisu dio početnog obima.

## Historija evidencije

- **11.11.2026.** Pregledan je dostavljeni MVP zahtjev i radni folder. Potvrđeno je da folder nema projektnih datoteka; započeta je početna statusna evidencija ovim dokumentom.
- **11.11.2026.** Kreirana Next.js osnova, početna Prisma šema, autentifikacija sa RBAC helperima, login ekran, stvarni dashboard upiti, Docker Compose, seed skripta i README. Instalacija zavisnosti nije završena zbog timeouta prema npm registru; migracije i build ostaju neprovjereni.
- **11.11.2026.** Implementiran registar klijenata sa pretragom, paginacijom, profilom, kreiranjem, uređivanjem i arhiviranjem uz server-side RBAC i Zod validaciju. Dodani su testovi RBAC-a i vremenske zone; direktno pokretanje 8 testova pomoću Node.js type strippera je prošlo.
- **11.11.2026.** Paketi instalirani iz lokalnog cachea; Prisma Client i početna SQL migracija generisani. Prisma validacija, TypeScript, ESLint, 8 testova i produkcijski build su uspješno prošli. Baza nije pokrenuta i migracija nije primijenjena.
- **11.11.2026.** Prisma datasource proširen varijablom `DIRECT_URL` za direktnu/Supabase session konekciju pri migracijama; README dopunjen uputama za Supabase Transaction Pooler. Validacija Prisma šeme, TypeScript, ESLint, testovi i produkcijski build ponovo uspješno prolaze. Stvarni Supabase projekat još nije povezan niti je migracija izvršena.
- **11.11.2026.** Implementiran registar životinja: validacija, pretraga/paginacija, profil, unos, uređivanje, arhiviranje, RBAC i transakcijska historija vlasništva. Profil povezuje termine, medicinsku historiju i dozvolama ograničene račune; medicinska polja su zaštićena prema ulogama. TypeScript, ESLint, Prisma validacija, 11 testova i produkcijski build prolaze. Baza i Supabase i dalje nisu povezani, pa CRUD nad bazom nije end-to-end testiran.
- **11.11.2026.** Implementirano osnovno zakazivanje termina, dnevni raspored, mobilni prikaz karticama, statusne tranzicije i sprečavanje preklapanja veterinara uz transakciju. Vrijeme se konvertuje u vremensku zonu Sarajeva i testirane su DST granice. Dodana je donja mobilna navigacija; PWA offline/instalacija ostaje za kasniju fazu. TypeScript, ESLint, Prisma validacija, 15 testova i produkcijski build prolaze; baza još nije povezana za end-to-end testiranje.
- **11.11.2026.** Dovršen osnovni modul pregleda: walk-in i kreiranje iz termina, lista/pretraga, detalji, uređivanje i završetak; dodane su veze iz rasporeda i profila klijenta/životinje. Pregled i povezani termin ažuriraju se transakcijski, medicinski sadržaj je zaštićen RBAC-om, a unos prilagođen telefonu. ESLint, 19 testova i produkcijski build prolaze; stvarna baza i dalje nije povezana.
- **11.11.2026.** Dodano upravljanje terapijama na pregledu: unos/uklanjanje terapije uz dozu, učestalost, trajanje i upute, audit log i zabrana izmjene završenih pregleda. Validacija Zod usklađena je s dužinama polja Prisma modela. ESLint, TypeScript, Prisma validacija, produkcijski build i svih 20 testova prolaze; Supabase nije povezan.
- **11.11.2026.** Dodan modul lijekova i zaliha: registracija lijeka, prijem serije, rok trajanja, status niske zalihe i korekcije količina s razlogom. Primjena lijeka iz pregleda umanjuje zalihu uz uslov dovoljne količine i evidentira primjenu/kretanje/audit u istoj transakciji; odbijaju se istekle serije, nedovoljne količine i izmjene završenih pregleda. ESLint, Prisma validacija, TypeScript, produkcijski build i 23 testa prolaze; Supabase nije povezan.
- **11.11.2026.** Implementiran osnovni modul naplate: izdavanje numerisanih računa sa stavkama i porezom, veza sa završenim pregledom, prikaz/štampa računa i evidentiranje djelimičnih uplata uz ažuriranje statusa transakcijski. Dodan je periodični finansijski izvještaj i CSV izvoz pod finansijskom dozvolom. Dodani su testovi validacije računa, uplata i perioda; integracijsko testiranje baze čeka Supabase konekciju.
- **11.11.2026.** Implementiran cjenovnik usluga sa dozvolama za čitanje/uređivanje, uređivanjem cijena, arhiviranjem i reaktiviranjem. Aktivne usluge mogu se izabrati na računu; server ponovo provjerava status i trenutno prikazanu cijenu prije izdavanja. Dodani su testovi validacije usluga i RBAC-a.
- **11.11.2026.** Implementirano administratorsko upravljanje zaposlenima: kreiranje naloga uz hashiranje lozinke, izmjena profila/uloge, reset lozinke i aktivacija/deaktivacija. Posljednji aktivni administrator i vlastiti nalog za deaktivaciju su zaštićeni; dodani su testovi validacije i RBAC-a.
- **11.11.2026.** Dodan je djelimični/potpuni storno evidentirane uplate s obaveznim razlogom, provjerom raspoloživog iznosa i transakcijskim ažuriranjem statusa računa i audit loga. Detalji računa prikazuju historiju storna; integracijski test baze još čeka konekciju.
- **11.11.2026.** Dodan inventurni izvještaj s upotrebljivom zalihom, pragom minimuma, isteklim serijama i rokovima unutar 90 dana, te CSV izvoz po serijama. RBAC dozvola prati pristup modulu lijekova, bez dodjele finansijskog pristupa.
- **11.11.2026.** Dodana administratorska podešavanja podataka ambulante, prefiksa i porezne stope računa te standardnog trajanja termina. Brojač računa ostaje zaštićen, postavke se auditiraju, a trajanje termina se koristi kao početna vrijednost pri zakazivanju.
- **11.11.2026.** Podešavanja proširena sedmičnim radnim vremenom. Forma termina prikazuje radno vrijeme i ograničava izbor, a API odbija termine na zatvorene dane, van radnog vremena ili preko granice dana. Testirane su dozvoljene/zabranjene kombinacije.
- **11.11.2026.** Dodan sedmični i mjesečni kalendar termina s navigacijom po periodima, filterima veterinara/statusa i responsivnim prikazom, te pretraga dnevnog rasporeda po pacijentu, vlasniku, veterinaru i razlogu. Testirani su sedmični i mjesečni proračuni uključujući prijelaz mjeseca i prestupnu godinu; svih 37 testova, lint i produkcijski build su uspješni. Uređivanje termina i DB integracijske provjere ostaju otvoreni.
- **11.11.2026.** Dodano uređivanje zakazanih i potvrđenih termina kroz formu i API. Ažuriranje transakcijski provjerava klijenta, životinju, veterinara, radno vrijeme i konflikt s drugim terminom te zapisuje prethodne/nove vrijednosti u audit; termini s pregledom ili završenim statusom su zaključani. Dodani su testovi validacije; svih 37 testova, lint i produkcijski build prolaze. Integracijske provjere nad povezanom bazom nisu urađene.
- **11.11.2026.** Dodana historija kretanja zaliha s filterima perioda (do 366 dana), lijeka, tipa kretanja i korisnika, responsivnim prikazom te CSV izvozom do 5000 najnovijih zapisa. Endpoint i stranica koriste `reports:inventory`; dodani su testovi filtera i perioda. Svih 38 testova, lint i produkcijski build prolaze; Supabase integracijska provjera nije izvršena.
- **11.11.2026.** Dovršeno evidentiranje izvršenih usluga na aktivnom pregledu s količinom, cjenovnikom, historijskom cijenom, RBAC-om i auditom; završeni pregledi su zaključani. Račun iz pregleda sada predpopunjava ove usluge, dok primijenjene lijekove navodi kao ručne stavke bez izmišljanja prodajne cijene. Testovi, lint i produkcijski build prolaze; stvarna DB integracija nije potvrđena.
- **11.11.2026.** Pojednostavljen RBAC na dvije uloge: Admin ima sve dozvole; Veterinar može koristiti sve operativne module, uključujući klijente, životinje, termine, preglede, terapije, lijekove/zalihe, usluge, račune, uplate i izvještaje, ali ne može upravljati nalozima ni sistemskim postavkama. Dodana je migracija koja postojeće ADMIN naloge zadržava kao Admin, a sve ostale stare uloge svodi na Veterinar; migracija nije primijenjena jer baza nije povezana. Prisma klijent/testovi/build se validiraju nakon izmjene.
- **11.11.2026.** Primijenjene obje Prisma migracije na konfigurisanu Supabase bazu; migracija za dvije uloge je uspješna i ponovna provjera javlja da nema migracija na čekanju. Implementiran je storno računa uz obavezni razlog, audit log i transakcijsku provjeru: postojeći izdati račun se ne briše, a sve evidentirane uplate moraju biti stornirane prije storna računa. Finansijski zbir/CSV sada isključuju stornirane račune, a izvještaj ispravno prikazuje status. Lokalni testovi, lint i Prisma validacija su prošli; produkcijski build se ponavlja nakon završnih izmjena.
- **11.11.2026.** Dodana PWA instalacija s manifestom, Android/iOS ikonama, instalacijskim pozivom/uputama, service worker-om i offline obavijesti. Service worker ne kešira zaštićene stranice ni podatke; nakon potvrde odabrano je online-only ponašanje. Obrazac pregleda dobio je stalno dostupne mobilne akcije za čuvanje i završetak. Dodani su service worker testovi koji provjeravaju da API/lični podaci nisu keširani i da se koristi samo generička offline stranica. Svih 39 testova, ESLint i produkcijski build prolaze; manifest, worker, offline ekran i PNG ikone prošli su HTTP smoke provjere.
- **11.11.2026.** Dovršen dodatni pregled mobilne upotrebljivosti: registri klijenata/životinja imaju kartični prikaz; meni „Više” daje pristup ostalim modulima, izvještajima i odjavi; popravljeni su rasporedi zaglavlja, veličine dugmadi i polja na profilima i formama. Ispravljeno je i prikazivanje slobodnog polja spola životinje. Zaštićene stranice nisu pregledane kroz prijavljenu sesiju niti je testirano na fizičkom telefonu. Nakon izmjena prolaze svih 39 testova, ESLint i produkcijski build.
