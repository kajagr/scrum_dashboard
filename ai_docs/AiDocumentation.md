# Uporaba umetne inteligence pri razvoju aplikacije ScrumBoard

## Splošno

Pri razvoju aplikacije ScrumBoard smo umetno inteligenco (Claude, Anthropic) sistematično uporabljali kot razvojnega pomočnika. AI je pomagal pri treh vrstah nalog: implementaciji frontend komponent, razvoju backend logike ter odpravljanju tehničnih napak in merge konfliktov. Vsak generiran odgovor smo pregledali, preizkusili in po potrebi popravili — AI ni nadomestil razumevanja kode, temveč ga je pospešil.

---

## Prompt 1 — Frontend: Design system in dark/light mode toggle (#30 + vse kartice)

### Kontekst

Aplikacija je bila sprva razvita z generičnimi Tailwind razredi (`bg-white`, `text-gray-900`) brez podpore za teme. Želeli smo uvesti enoten design system z CSS spremenljivkami ki podpira preklapljanje med temnim in svetlim načinom.

### Prompt

```
Imam Next.js aplikacijo s Tailwind v4. Vse komponente imajo hardcoded 
bg-white, text-gray-900 ipd. Želim uvesti design system z @theme inline 
CSS spremenljivkami ki podpira dark/light mode toggle.

Midnight Slate tema (dark, default):
- background: #151C2B, surface: #1C2333, foreground: #E8EDF5
- primary: #5B8DEF, accent: #8B5CF6, border: #2D3748, muted: #6B7A99

Cool Slate tema (light):
- background: #F1F5F9, surface: #FFFFFF, foreground: #1E293B
- border: #CBD5E1, muted: #64748B

Toggle naj shranjuje nastavitev v localStorage in jo aplicira 
z data-theme atributom na html elementu.

Nato preoblikuj priloženi Navbar.tsx z implementacijo toggle gumba.
```

### Kako smo uporabili odgovor

AI je predlagal strukturo `@theme inline` z `var(--x)` self-referencami. Ob prvem poskusu toggle ni deloval — identificirali smo da je bil problem v tem, da je Navbar nastavljal `data-theme="dark"` namesto da bi atribut odstranil (dark je default). To smo sami popravili. Ko je bil vzorec vzpostavljen, smo ga aplicirali na vse komponente.

---

## Prompt 2 — Frontend: Preoblikovanje komponent v design system (#8, #14, #16, #17)

### Kontekst

Po vzpostavitvi design systema smo imeli številne komponente z hardcoded barvami. Namesto ročnega popravljanja vsake komponente smo AI prosili za sistematično preoblikovanje.

### Prompt

```
Preoblikuj priloženi StoryDetailModal.tsx v naš design system.

Pravila:
- Vse bg-white → bg-surface ali bg-background
- Vse text-gray-* → text-foreground, text-muted ali text-subtle
- Vse border-gray-* → border-border
- bg-blue-* → bg-primary-light, text-blue-* → text-primary
- bg-green-* → bg-[rgba(52,211,153,0.12)], text-green-* → text-[#34D399]
- Nobenih inline styles, samo Tailwind classes

Ohrani vso logiko (acceptTask, resignTask, updateTaskStatus).
Resign gumb naj ima inline confirm namesto window.confirm().
```

### Kako smo uporabili odgovor

AI je pravilno zamenjal večino barv. Pri nekaterih komponentah (SprintBoardPage) je kljub navodilu ohranil inline styles — te smo ročno prepisali. Inline confirm za resign je bil dobra rešitev ki je izboljšala UX.

---

## Prompt 3 — Backend: Prijava in upravljanje uporabnikov (#1, #30)

### Kontekst

Potrebovali smo API endpoint za pridobivanje profila prijavljenega uporabnika in ločen modal za spremembo gesla.

### Prompt

```
Napiši Next.js 15 API GET /api/users/profile ki:
- Avtenticira uporabnika z Supabase server clientom
- Vrne username, email, first_name, last_name in system_role
- Polje system_role vrne kot "role" v JSON odgovoru

Nato napiši ChangePasswordModal.tsx komponento ki:
- Zahteva staro geslo in novo geslo (min 6 znakov) + potrditev
- Kliče PUT /api/users/profile
- Ima stopPropagation na backdrop kliku da ne zapre ProfileModal za njim
- Uporablja naš design system (bg-surface, text-foreground...)
```

### Kako smo uporabili odgovor

Pri prvem poskusu je `ChangePasswordModal` ob napaki strežnika zaprl tudi `ProfileModal` ker backdrop klik ni imel `stopPropagation`. AI je to pozabil implementirati — sami smo dodali `e.stopPropagation()` na wrapper div in backdrop. Polje `role` vs `system_role` je povzročilo bug v `ProjectsPage` ki je vedno prikazoval gumb New Project — ugotovili smo ga sami in popravili.

---

## Prompt 4 — Backend: Upravljanje članov projekta (#4)

### Kontekst

Pri ustvarjanju projekta je bil creator samodejno dodan kot `product_owner` v route, nato pa je modal poskušal dodati iste člane še enkrat — kar je vrnilo 400 napako in zaustavilo dodajanje ostalih članov.

### Prompt

```
Imam bug pri dodajanju projekta. POST /api/projects samodejno doda 
creatorja kot product_owner, nato CreateProjectModal pošlje drugi 
request na /api/projects/[id]/members z vsemi člani vključno s creatorjem.
Members route vrne 400 "already a member" in ustavi vse.

Popravi:
1. Odstrani auto-add creatorja iz projects route
2. Members route naj loči med toInsert (novi) in toUpdate (obstoječi —
   posodobi samo vlogo), nikoli ne vrne 400 za obstoječe člane

Ohrani NextJS 15 await params vzorec.
```

### Kako smo uporabili odgovor

AI je pravilno identificiral problem in predlagal split na `toInsert` in `toUpdate`. Rešitev je delovala pravilno na prvič.

---

## Prompt 5 — Backend + Frontend: Dodeljevanje zgodb sprintu (#13, #27)

### Kontekst

Potrebovali smo endpoint za dodeljevanje zgodb aktivnemu sprintu z validacijo velocity omejitve, ter frontend ki onemogoči gumb ko bi bila omejitev prekoračena.

### Prompt

```
Napiši POST /api/projects/[projectId]/backlog/assign ki:

Validacije (v tem vrstnem redu):
1. storyIds mora biti neprazen array
2. Aktivni sprint mora obstajati (start_date <= danes <= end_date)
3. Vse zgodbe morajo imeti story_points != null
4. Nobena zgodba ne sme imeti status = 'done'
5. Nobena zgodba ne sme biti že dodeljena aktivnemu sprintu
6. story_points izbranih zgodb + že dodeljenih ne sme preseči velocity
   (samo če je velocity nastavljen)

Vrni opisne napake v angleščini.

Nato posodobi BacklogPage.tsx:
- Zgodbe brez story_points prikaži kot sive z rdečim "No SP" badge-om
- Gumb "Add to sprint" onemogoči ko selectedPoints > remainingVelocity
- V sprint banneru prikaži "X/Y pts" porabe
```

### Kako smo uporabili odgovor

AI je v prvem poskusu preverjal velocity pred fetchom zgodb — logiko smo sami preuredili v pravilni vrstni red. Frontend implementacija je bila pravilna, velocity warning tooltip pa smo dodali sami.

---

## Prompt 6 — Frontend: Product Backlog stran (#27, #9)

### Kontekst

Potrebovali smo enotno Product Backlog stran ki združuje vse zgodbe v treh tabih in podpira role-based vidljivost gumbov.

### Prompt

```
Napiši BacklogPage.tsx (Next.js "use client") ki:

1. Fetchira /api/projects/[projectId]/backlog ki vrne:
   { activeSprint, unassigned, assigned, realized }

2. Prikazuje 3 tabe s števci: Unassigned / In active sprint / Done

3. Active sprint banner z imenom in datumi (ali opozorilo če ni)

4. Na Unassigned tabu:
   - Checkboxi za izbiro zgodb (samo SM in PO)
   - Select all gumb
   - "Add X to sprint" gumb (disabled če ni aktivnega sprinta 
     ali prekoračena velocity)
   - Sort: Date / Business value / Priority

5. Role check: fetchaj /api/projects/[projectId]/members/me
   - canCreate: role !== 'developer'
   - canAssign: role !== 'developer'

Uporabi naš design system.
```

### Kako smo uporabili odgovor

Osnovna struktura je bila pravilna. `router.refresh()` v `CreateStoryModal` je preprečeval osvežitev liste — sami smo identificirali da povzroči remount starša in prepreči `loadBacklog()` klic. Odstranili smo ga.

---

## Prompt 7 — Frontend: Sprint Board z nalogami (#14, #15, #16, #17, #18, #20, #28)

### Kontekst

Sprint Board je moral prikazovati zgodbe aktivnega sprinta z razpenjanjem nalog po kategorijah, ter podpirati sprejemanje, odpoved, start, pause in done akcije direktno na kartici.

### Prompt

```
Napiši SprintBoardPage.tsx ki:

1. Fetchira backlog (za aktivni sprint + assigned zgodbe) in members/me
2. Prikaže zgodbe kot razpenjljive kartice sortirane po status → priority
3. Vsaka zgodba se razpne in pokaže naloge v 4 kategorijah:
   active / assigned / unassigned / done
4. Na vsaki nalogi prikaži ustrezne gumbe glede na stanje:
   - Accept: canAccept && !is_accepted && (isUnassigned || isProposedToMe)
   - Start: isMyTask && status === 'assigned'
   - Pause: isMyTask && status === 'in_progress'
   - Resign: isMyTask && !isDone → inline confirm (ne window.confirm)
   - Edit/Delete: canAddTasks && !is_accepted && !completed
5. Progress bar (done SP / total SP)
6. Edit task modal z AssigneeDropdown

Vse v design systemu brez inline styles.
```

### Kako smo uporabili odgovor

Generirana koda je imela merge konflikte med dvema vejama — ena je uporabljala Tailwind classes, druga inline styles. AI je rešil konflikte po pravilu "feature/16 styling + main logika". Pri dveh mestih je ohranil napačno poimenovanje spremenljivk (`config` vs `cfg`) ki smo ga sami popravili.

---

## Prompt 8 — Frontend: Custom dropdown za dodelitev naloge (#14)

### Kontekst

Standardni `<select>` element ni vizualno ustrezal design systemu. Potrebovali smo custom dropdown z avatarji, imeni in role badge-i za vsako opcijo.

### Prompt

```
Napiši AssigneeDropdown React komponento za CreateTaskModal ki:
- Prikazuje trigger gumb z avatarjem izbranega člana ali placeholder
- Ob kliku odpre dropdown s seznamom članov
- Vsak element: inicialke avatar (bg-primary-light), ime, email, 
  role badge (SM / Dev)
- Checkmark ob trenutno izbranem
- "No assignment" kot prva opcija
- Zapre se ob kliku zunaj (useRef + mousedown event listener)
- Gumb × ob izbranem za čiščenje brez odpiranja dropdowna

Dropdown mora biti overflow-y-auto z max-h-56 da se scrolla
pri večjem številu članov.
```

### Kako smo uporabili odgovor

Komponenta je delovala, ampak dropdown se ni mogel scrollati — `overflow-hidden` na modal wrapperju ga je klippal. AI je predlagal odstranitev `overflow-hidden` z wrapperja. Zaokroženost roba smo ohranili z `rounded-t-2xl` na accent baru.

---

## Prompt 9 — Reševanje merge konfliktov (#16, #17)

### Kontekst

Po merganju veje `feature/16-sprejemanje-naloge` z `main` so nastali obsežni konflikti v treh datotekah. Veja `feature/16` je imela Tailwind design system, `main` pa inline styles z `var(--color-*)`.

### Prompt

```
Reši merge konflikte v priloženih datotekah (AdminUsersPage.tsx, 
StoryDetailModal.tsx, CreateTaskModal.tsx).

Pravilo: vedno vzemi feature/16 verzijo za styling (Tailwind classes).
Iz main ohrani vse kar ni v feature/16: 
- openEdit(), saveEdit(), deleteTask() funkcije
- izboljšano error handling brez alert()
- angleška sporočila

Prilagam vse tri datoteke s conflict markerji <<<<<< / ======= / >>>>>>>
```

### Kako smo uporabili odgovor

AI je pravilno rešil večino konfliktov. V `SprintBoardPage` je ohranil `config` namesto `cfg` — sami smo popravili. Edit modal je bil generiran z inline styles kljub navodilu — ročno smo ga prepisali v Tailwind classes po vzoru ostalih modalov.

---
 
## Prompt 10 — Testiranje: Unit testi za API route-e (#1, #4, #6, #8, #9, #13, #14, #15, #16, #17, #18, #20, #27, #28, #30)
 
### Kontekst
 
Za vsako kartico smo pisali ločeno testno datoteko (`1-users.test.ts`, `4-projects.test.ts`, ..., `18-timelog.test.ts` itd.). Ker Next.js route-i direktno kličejo Supabase, smo potrebovali enoten vzorec za mockanje baze brez dejanske povezave. Isti prompt smo z manjšimi prilagoditvami uporabili za vse kartice.
 
### Prompt (splošni vzorec)
 
```
Napiši Jest unit teste v TypeScript za Next.js 15 API route 
[ime route-a] ki pokrijejo vse testne primere iz use kartice #[številka].
 
Splošna navodila:
- Supabase mockaj z jest.mock("@/lib/supabase/server")
- mockFrom implementiraj s counter vzorcem: vsak zaporedni klic 
  supabase.from() vrne drugačen mock glede na vrstni red v route-u
- Helper funkcije: makeRequest(url, method, body?) in makeContext(params)
- beforeEach: jest.clearAllMocks() + mockGetUser za prijavljenega userja
- setupMocks() helper ki sprejme overrides za edge case-e
 
Testiraj te primere:
1. 200/201 — regularen potek (happy path)
2. 400 — [specifična validacija iz kartice]
3. 400 — [druga validacija]
4. 401 — neprijavljen uporabnik
5. [dodatni edge case-i specifični za kartico]
 
Prilagam route implementacijo: [route.ts]
```
 
### Kako smo uporabili odgovor
 
AI je za vsako kartico generiral osnovno strukturo testov. Najpogostejša težava je bila **vrstni red `from()` klicev** — counter v `mockFrom` se zamakne ko dodaš novo DB operacijo v route, kar poruši vse nadaljnje teste. To smo vedno preverili ročno s preštevanjem `from()` klicev v dejanskem route-u. Za kartice z bolj kompleksno logiko (npr. #18 agregacija časa po dnevu, #13 velocity preverjanje) AI ni pokrival vseh edge case-ov v prvem poskusu — testne primere smo dopolnili sami. Za React komponente (28-task-list.test.tsx) smo uporabili React Testing Library namesto Jest, kar je zahtevalo drugačen pristop ki ga AI ni predlagal samodejno.
 
---


## Zaključek

### Kdaj je bil AI najučinkovitejši

- **Boilerplate in ponavljajoči vzorci** — generiranje modalov, route handlerjev in validacij po vzpostavljenem vzorcu
- **Sistematično refaktoriranje** — zamenjava hardcoded barv v celih datotekah
- **Reševanje konfliktov** — razreševanje Git konfliktov po jasno določenih pravilih
- **Identifikacija vzrokov napak** — razlaga zakaj `router.refresh()` povzroči remount ali zakaj `overflow-hidden` klippa dropdown

### Kdaj je bil AI manj zanesljiv

- **Next.js 15 specifični vzorci** — `await params` je bilo treba večkrat preveriti
- **Kompleksna state logika** — zaporedje async klicev in odvisnosti med `useState` hooki
- **Konsistentnost poimenovanja** — mešanje konvencij med daljšim pogovorom
- **Upoštevanje vseh navodil** — pri daljših promptih je AI občasno spregledal posamezno zahtevo