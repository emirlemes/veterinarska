# Veterinary Management System

Web aplikacija za svakodnevni rad veterinarske ambulante. Korisnički interfejs je na bosanskom jeziku, a novčani iznosi se vode u BAM/KM.

## Tehnologije

- Next.js App Router, React i TypeScript
- Tailwind CSS
- Auth.js Credentials autentifikacija i kontrola pristupa po ulogama
- PostgreSQL i Prisma ORM
- Zod validacija i bcrypt hashiranje lozinki

## Trenutni status

Implementirani moduli i otvoreni zahtjevi opisani su u [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md). Aplikacija koristi dvije uloge:

- **Admin** — puni pristup svim funkcijama, uključujući korisničke naloge i sistemske postavke.
- **Veterinar** — pristup svim operativnim funkcijama ambulante; ne može upravljati korisničkim nalozima ni sistemskim postavkama.

Prisma migracije su primijenjene na trenutno konfigurisanu Supabase bazu. Migracija uloga zadržava postojeće Admin naloge kao Admin, a stare ne-Admin uloge pretvara u Veterinar.

## Instalacija na mobitel

Aplikacija se može instalirati kao PWA i koristi isti prijavni nalog kao web aplikacija. Za instalaciju je potreban HTTPS; `localhost` je izuzetak za lokalni razvoj.

- **Android (Chrome):** otvoriti adresu aplikacije, prijaviti se i dodirnuti **Instaliraj VetCare**. Ako se dugme ne prikaže, otvoriti Chrome meni i izabrati **Instaliraj aplikaciju** ili **Dodaj na početni ekran**.
- **iPhone/iPad (Safari):** otvoriti adresu aplikacije, dodirnuti **Podijeli**, pa **Dodaj na početni ekran**.

Pregledi i ostali podaci rade uz internet vezu. Servisni worker ne kešira prijavljene stranice, API odgovore ni medicinske podatke; offline ekran samo objašnjava da je veza potrebna.

## Zahtjevi

- Node.js 20.9 ili noviji
- npm
- Docker Desktop ili drugi Docker Compose runtime

## Lokalno pokretanje

1. Instalirati pakete:

   ```bash
   npm install
   ```

2. Napraviti lokalni environment fajl i postaviti jedinstvenu administratorsku lozinku:

   ```bash
   cp .env.example .env
   ```

   Generisati tajnu za Auth.js, naprimjer:

   ```bash
   openssl rand -base64 32
   ```

   Unijeti generisanu vrijednost kao `AUTH_SECRET`, te postaviti `ADMIN_EMAIL` i `ADMIN_PASSWORD` u `.env`. Seed zahtijeva lozinku od najmanje 12 znakova.

3. Pokrenuti PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

   Ako koristiš Supabase umjesto lokalnog Docker PostgreSQL-a, zamijeni
   `DATABASE_URL` i `DIRECT_URL` u `.env` konekcijskim stringovima iz
   Supabase projekta. Runtime koristi `DATABASE_URL`, a Prisma migracije
   direktnu vezu `DIRECT_URL`; detalji su u odjeljku [Supabase konekcija](#supabase-konekcija).

4. Generisati Prisma klijent, primijeniti početnu migraciju i kreirati administratorski račun:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   Seed koristi vrijednosti iz `.env`; ponovnim pokretanjem ažurira administratorsku lozinku na vrijednost iz `ADMIN_PASSWORD`.

5. Pokrenuti razvojni server:

   ```bash
   npm run dev
   ```

   Otvoriti [http://localhost:3000](http://localhost:3000) i prijaviti se administratorskim podacima iz `.env`.

## Deployment na Vercel

1. Postavi izvorni kod u Git repozitorij i importuj ga u Vercel kao Next.js
   projekat. Odaberi direktorij koji sadrži `package.json` kao Root Directory.
   Koristi podrazumijevane postavke za install, build i output; `npm run build`
   generiše Prisma klijent i zatim pokreće Next.js build. Ne prenosi `dist/`
   niti lokalni `.env` na Vercel.
2. U **Settings → Environment Variables** postavi `DATABASE_URL` na dostupnu
   PostgreSQL runtime konekciju (za Supabase transaction pooler), `AUTH_SECRET`
   na jedinstvenu tajnu i `AUTH_TRUST_HOST` na `true`. Po potrebi postavi
   `NEXT_PUBLIC_ERROR_LOGGING`; ta se vrijednost ugrađuje tokom builda.
   Izaberi odgovarajuća Production i Preview okruženja te koristi odvojenu
   bazu i tajne za testiranje, kako testovi ne bi mijenjali produkcijske podatke.
3. Prije korištenja aplikacije primijeni migracije iz izvornog projekta na
   odgovarajuću bazu pomoću `npm run db:deploy`. Za početni administratorski
   račun po potrebi jednom pokreni `npm run db:seed` s podešenim
   `ADMIN_EMAIL` i `ADMIN_PASSWORD`. Za ove komande lokalno postavi
   `DATABASE_URL` i `DIRECT_URL` za ciljnu bazu; provjeri cilj prije pokretanja.
   Ponovni seed ažurira administratorsku lozinku. Migracije i seed se ne
   pokreću automatski pri Vercel buildu.
4. Pokreni deployment na Vercelu. Nakon izmjene environment varijabli napravi
   novi deployment. Serverski ispisi dostupni su u Vercel runtime logovima.

## Environment varijable

| Varijabla | Opis |
|---|---|
| `DATABASE_URL` | PostgreSQL runtime konekcija (za Supabase može biti pooler); lokalni primjer je u `.env.example` |
| `DIRECT_URL` | Direktna PostgreSQL konekcija za Prisma migracije |
| `AUTH_SECRET` | Tajna koju Auth.js koristi za sesije |
| `AUTH_TRUST_HOST` | Uključiti povjerenje u lokalni host; primjer je podešen na `true` |
| `NEXT_PUBLIC_ERROR_LOGGING` | Postaviti na `true` za dodatne dijagnostičke ispise grešaka; zadano je isključeno |
| `PERFORMANCE_LOGGING` | Postaviti na `true` za trajanje Prisma upita u serverskim logovima; zadano je isključeno |
| `ADMIN_EMAIL` | E-mail početnog administratorskog računa |
| `ADMIN_PASSWORD` | Lozinka početnog administratora (najmanje 12 znakova) |

`.env` ne dodavati u repozitorij.

### Bilježenje grešaka za testiranje

Za testno okruženje postavi `NEXT_PUBLIC_ERROR_LOGGING=true` i ponovo izgradi i
deployaj aplikaciju. Za isključivanje postavi `false` i ponovi build i deploy:
Next.js ugrađuje ovu javnu varijablu u kod preglednika tokom builda.

Dodatni ispisi koriste `console.log`: neočekivane greške i neobrađeni promise-i
pojavljuju se u konzoli preglednika, a greške zahtjeva koje Next.js uhvati u
server logovima. Neuspjeli `fetch` zahtjevi i HTTP odgovori s greškom također se
ispisuju u pregledniku; za detalje zahtjeva koristi karticu Network. Očekivani
HTTP odgovori poput validacijskih grešaka mogu se također pojaviti u konzoli.
Ovo ne otkriva sve moguće greške niti bilježi svaku grešku koju aplikacija
interno obradi; postojeći ispisi aplikacije i Next.js-a nisu obuhvaćeni flagom.
Server logovi nisu automatski vidljivi testeru u pregledniku.

Poruke i stack traceovi mogu sadržavati osjetljive podatke. Koristi ovu opciju
samo u zaštićenom testnom okruženju s testnim podacima i ne dijeli logove bez
provjere njihovog sadržaja.

### Mjerenje brzine

Nakon deploya otvori DevTools Console u istoj kartici aplikacije i uključi
ispise za tu karticu, zatim osvježi stranicu:

```js
sessionStorage.setItem("vetcare:performance-logging", "true");
location.reload();
```

Ispisi `[VetCare performance]` sadrže trajanje početnog učitavanja i mrežnih
RSC zahtjeva u milisekundama. `firstByteMs` je vrijeme od početka zahtjeva do
prvog bajta (uključuje mrežu i čekanje servera), a `totalMs` uključuje i
preuzimanje odgovora. RSC zahtjevi mogu biti unaprijed učitani prije klika;
nisu mjera vremena do prikaza stranice i neće se pojaviti za navigaciju koja
koristi već učitani sadržaj. Ispis prikazuje samo naziv modula, bez punog URL-a,
parametara, identifikatora ili sadržaja odgovora. Isključi ga u istoj kartici:

```js
sessionStorage.removeItem("vetcare:performance-logging");
location.reload();
```

Za dodatnu provjeru baze privremeno postavi `PERFORMANCE_LOGGING=true` u Vercel
environment varijablama i napravi novi deployment. Vercel runtime logovi će
prikazati trajanje pojedinačnih Prisma upita, bez SQL-a i parametara. Upiti se
mogu izvršavati paralelno i logovi se mogu preplitati između zahtjeva, pa ih ne
treba jednostavno sabirati niti pripisivati pojedinom kliku. Po završetku ukloni
varijablu ili je postavi na `false` i ponovo deployaj.

Visok `firstByteMs` sam po sebi ne dokazuje spor upit: uporedi ga s vremenima
upita, hladnim pokretanjem servera i geografskom udaljenošću. U Vercel i
Supabase postavkama provjeri da su regija serverless funkcija i regija baze
blizu jedna drugoj; ne mijenjaj regije bez provjere posljedica za deployment.

## Supabase konekcija

1. U Supabase dashboardu otvori projekat i klikni **Connect**. Za `DATABASE_URL`
   kopiraj URI za **Transaction pooler** (port `6543`). To je konekcija koju će
   aplikacija koristiti pri radu.
2. Za `DIRECT_URL` kopiraj **Direct connection** URI (najčešće port `5432`).
   Ako tvoja mreža ne podržava IPv6 i direktni host nije dostupan, koristi
   Supabase **Session pooler** URI, obično port `5432`.
3. U `.env` zamijeni vrijednosti, zadržavajući odvojene varijable:

   ```dotenv
   DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@<REGION>.pooler.supabase.com:6543/postgres"
   DIRECT_URL="postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres"
   ```

   Ovo su primjeri oblika URI-ja — zamijeni vrijednosti stvarnim stringovima
   iz **Connect** prozora. Ako password sadrži specijalne znakove, URL-enkodiraj
   ih ili kopiraj gotov URI koji Supabase prikaže. Ne šalji lozinku, URI ili
   sadržaj `.env` u chat i ne commitaj `.env`.
4. Pokreni aplikacijsku migraciju i početni administratorski račun:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   Migracija kreira tabele u Supabase bazi. Pokreni je samo nad bazom/projektom
   koji pripada ovoj aplikaciji.
5. Zatim pokreni `npm run dev`. U Supabase **Table Editor** možeš provjeriti
   kreirane tabele.

## Korisne komande

```bash
npm run dev          # razvojni server
npm run lint         # ESLint
npm test             # RBAC i lokalno vremensko testiranje
npm run build        # produkcijski build
npm run db:generate  # generisanje Prisma klijenta
npm run db:migrate   # razvojna migracija baze
npm run db:deploy    # primjena migracija u produkciji
npm run db:seed      # početni administrator i podešavanja ambulante
npm run db:studio    # Prisma Studio
docker compose down  # zaustavljanje lokalnog PostgreSQL-a
```

## Uloge

- **Admin:** puni pristup aplikaciji, uključujući upravljanje korisnicima i sistemskim postavkama.
- **Veterinar:** puni pristup svakodnevnom radu ambulante — klijenti, životinje, termini, pregledi, terapije, lijekovi i zalihe, usluge, računi, uplate i izvještaji. Upravljanje korisničkim nalozima i sistemskim postavkama ostaje samo za Admina.

Dozvole se provjeravaju na serveru. `src/lib/auth/require-permission.ts` služi za stranice, a `src/lib/auth/authorize-api-request.ts` za buduće API rute.

## Napomene

- PostgreSQL Docker postavke su namijenjene lokalnom razvoju. Za produkciju koristiti sigurne kredencijale i odgovarajuće upravljanje tajnama.
- Cijene, računi i uplate koriste decimalne iznose u bazi; ne koristiti floating-point za poslovne obračune.
- Svi podaci koji će se unositi kroz aplikaciju trebaju biti stvarni zapisi u bazi; kontrolna tabla ne koristi demonstracijske podatke.
