# Mise en route

## Ce qu'il faut avoir

| Outil | Version | Pourquoi |
|---|---|---|
| Node.js | 20 ou 22 | L'application et les tests |
| PostgreSQL (client `psql`) | 14+ | Lancer les tests de règles métier en local |
| Compte Supabase | gratuit | Base de données, authentification |
| Xcode / Android Studio | facultatif | Seulement pour les émulateurs ; le navigateur suffit pour commencer |

---

## 1. Les tests, avant tout

Ils ne demandent aucune configuration et prouvent que tout fonctionne.

```bash
git clone https://github.com/medsamet/Coiffrdv.git
cd Coiffrdv

# Cœur métier TypeScript — 46 tests
npm install
npm test

# Règles métier sur une vraie base PostgreSQL — 11 groupes
npm run test:db
```

`npm run test:db` démarre un PostgreSQL temporaire, applique les migrations, joue les
tests puis nettoie tout. Si un PostgreSQL tourne déjà chez vous :

```bash
PGHOST=localhost PGUSER=postgres npm run test:db
```

---

## 2. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project**. Choisissez la région la plus
   proche (Francfort ou Paris pour la Tunisie).
2. **SQL Editor** → collez et exécutez, dans l'ordre, les quatre fichiers de
   `supabase/migrations/`.
   N'appliquez **pas** `supabase/tests/00_local_auth_shim.sql` : Supabase fournit déjà
   le schéma `auth`.
3. **Authentication → Providers** :
   - *Email* : activé, « Confirm email » activé.
   - *Phone* : activé, avec un fournisseur SMS (Twilio, MessageBird, ou un agrégateur
     tunisien compatible).
4. **SQL Editor** → exécutez `supabase/seed.sql` pour créer le salon de démonstration.
5. Créez le compte du coiffeur depuis **Authentication → Users**, puis passez son rôle :
   ```sql
   update public.profiles set role = 'barber' where email = 'coiffeur@coupe-style.tn';
   update public.salons set owner_id = (
     select id from public.profiles where email = 'coiffeur@coupe-style.tn'
   );
   ```

### Avec la CLI Supabase (plus simple si vous l'avez)

```bash
npm install -g supabase
supabase link --project-ref VOTRE_REF
supabase db push          # applique migrations/ dans l'ordre
supabase db reset         # en local : migrations + seed.sql
```

---

## 3. Lancer l'application

```bash
cd apps/mobile
cp .env.example .env      # renseignez URL et clé anon (Project Settings → API)
npx expo start
```

Puis, dans le terminal :

- **`w`** → ouvre la version web dans le navigateur
- **`i`** → simulateur iOS (macOS uniquement)
- **`a`** → émulateur Android
- ou scannez le QR code avec **Expo Go** sur votre téléphone

C'est le même code dans les trois cas.

---

## 4. Publier sur les stores

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all      # compile dans le cloud, pas besoin de Mac
eas submit --platform all
```

Prérequis : compte développeur Apple (99 $/an) et Google Play (25 $ une fois).

---

## Organisation du dépôt

```
maquettes/            Les maquettes validées (HTML, à ouvrir dans un navigateur)
docs/                 Spécification, choix technique, modèle de données
scripts/test-db.sh    Migrations + tests sur une base jetable
supabase/
  migrations/         Schéma et logique métier — appliqués dans l'ordre des noms
  tests/              Tests des règles métier, en SQL
  seed.sql            Salon de démonstration
packages/core/        Règles partagées TypeScript (argent, temps, identités, créneaux)
apps/mobile/
  app/                Écrans, routés par Expo Router selon l'arborescence
    (auth)/           Connexion, inscription, vérification du code
    (client)/         Accueil, réservation, mes rendez-vous, profil
    (pro)/            Tableau de bord, demandes, agenda, réglages
  src/lib/            Client Supabase, accès aux données, session
  src/components/     Briques d'interface
```

---

## Questions fréquentes

**« La clé anon est dans le code, ce n'est pas dangereux ? »**
Non : elle est publique par conception, comme une clé d'API front-end. Ce qui protège
les données, ce sont les politiques RLS et les fonctions `security definer`. Le test 10
de `supabase/tests/01_business_rules_test.sql` vérifie précisément qu'un client
authentifié ne voit que ses propres rendez-vous. La clé à ne jamais exposer est
`service_role`.

**« Pourquoi les prix sont des entiers bizarres ? »**
`20000` = 20 dinars. Tout est stocké en millimes, en entier, pour qu'aucune addition
de prix ne dérive. `formatTND()` fait la mise en forme.

**« Comment ajouter une cinquième prestation ? »**
Il faut ajouter une valeur à l'énumération `service_kind` (migration
`alter type ... add value`), puis les libellés dans `packages/core/src/appointments.ts`.
C'est volontairement un peu rigide : les quatre types sont une décision produit, pas
une liste que l'on remplit à la volée.
