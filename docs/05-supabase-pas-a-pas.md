# Installer Supabase — pas à pas

Comptez 15 minutes. Aucune connaissance de PostgreSQL n'est nécessaire : vous
copiez deux fichiers, vous cliquez sur **Run**, c'est tout.

À la fin, l'application tournera sur votre machine avec une vraie base de données.

---

## Étape 1 — Créer le projet

1. Allez sur [supabase.com/dashboard](https://supabase.com/dashboard) et connectez-vous.
2. Bouton vert **New project**.
3. Remplissez :
   - **Name** : `coiffrdv`
   - **Database Password** : cliquez sur **Generate a password**, puis
     **copiez-le et gardez-le** dans un endroit sûr. Vous n'en aurez pas besoin
     pour l'application, mais on ne peut plus le relire ensuite.
   - **Region** : `Central EU (Frankfurt)` — c'est la plus proche de la Tunisie.
4. **Create new project**, puis patientez 1 à 2 minutes pendant la création.

> ✅ **C'est bon quand** le bandeau « Setting up your project » a disparu et que
> vous voyez le tableau de bord du projet.

---

## Étape 2 — Installer la base de données

1. Dans la barre latérale gauche, cliquez sur l'icône **SQL Editor**
   (elle ressemble à une feuille de code, environ au milieu du menu).
2. Cliquez sur **New query** en haut.
3. Ouvrez le fichier **`setup.sql`**, sélectionnez **tout** son contenu
   (Ctrl+A / Cmd+A), copiez, et collez dans la grande zone de texte.
   *(Le fichier n'est pas dans le dépôt : il s'obtient avec
   `./scripts/build-setup-sql.sh`, qui assemble les migrations.)*
4. Cliquez sur **Run** (en bas à droite, ou Ctrl+Entrée).

L'exécution prend 2 à 3 secondes.

> ✅ **C'est bon quand** le panneau du bas affiche `Success. No rows returned`.
>
> Pour voir le détail, ouvrez l'onglet **Messages** juste à côté de **Results** :
> vous devez y lire
> ```
> INSTALLATION OK
> 8 tables, 4 fonctions metier, 15 politiques RLS
> ```

Vous pouvez vérifier visuellement : **Table Editor** dans la barre latérale doit
maintenant montrer 8 tables (`appointments`, `notifications_outbox`,
`opening_hours`, `profiles`, `recurring_breaks`, `salons`, `services`,
`time_blocks`).

> ⚠️ Si une erreur apparaît, ne relancez pas en boucle : le message est explicite,
> lisez-le.

---

## Étape 3 — Régler la connexion (important pour tester)

1. Barre latérale → **Authentication** → onglet **Sign In / Providers**.
2. **Email** doit être activé (c'est le cas par défaut).
3. **Désactivez « Confirm email »** pour l'instant.

   Pourquoi : sans serveur d'envoi configuré, Supabase utilise son SMTP de
   dépannage, limité à quelques messages par heure. Vous seriez bloqué dès le
   deuxième compte de test. On réactivera la confirmation quand l'envoi d'emails
   sera en place.

4. **Phone** : laissez désactivé pour l'instant. L'inscription par téléphone
   exige un fournisseur SMS (Twilio ou équivalent) et chaque message est payant.
   On l'activera quand vous aurez choisi votre fournisseur — le code de
   l'application est déjà prêt pour les deux.

> ✅ **C'est bon quand** Email est activé et « Confirm email » décoché.

---

## Étape 4 — Créer le compte du coiffeur

1. **Authentication** → onglet **Users** → bouton **Add user** →
   **Create new user**.
2. Renseignez :
   - **Email** : l'adresse du coiffeur. Prenez la vôtre pour tester, ou gardez
     `coiffeur@coupe-style.tn`.
   - **Password** : ce que vous voulez, minimum 8 caractères. **Notez-le**,
     c'est avec ça que vous vous connecterez à l'application.
   - **Auto Confirm User** : **cochez cette case**.
3. **Create user**.

> ✅ **C'est bon quand** la ligne apparaît dans la liste des utilisateurs.
>
> Vérification utile : **Table Editor** → table **profiles** doit contenir une
> ligne, créée automatiquement. Si elle est vide, c'est que l'étape 2 ne s'est
> pas terminée — reprenez-la.

---

## Étape 5 — Créer le salon

1. Ouvrez le fichier **`supabase/bootstrap-salon.sql`**.
2. **Modifiez une seule ligne**, tout en haut du fichier :

   ```sql
   v_email_coiffeur text := 'coiffeur@coupe-style.tn';
   ```

   Remplacez l'adresse par celle du compte créé à l'étape 4.
   *(Vous pouvez aussi changer juste en dessous le nom du salon, son adresse et
   son téléphone — ce sont les lignes `v_nom`, `v_adresse`, `v_telephone`.)*

3. **SQL Editor** → **New query** → collez tout → **Run**.

> ✅ **C'est bon quand** un tableau s'affiche avec vos quatre prestations :
>
> | prestation | duree | tarif | creneaux_7_prochains_jours |
> |---|---|---|---|
> | Barbe | 15 min | 7.000 DT | 159 |
> | Cheveux | 30 min | 15.000 DT | 139 |
> | Barbe + Cheveux | 45 min | 20.000 DT | 129 |
> | Coupe enfant | 20 min | 10.000 DT | 149 |
>
> Les nombres de créneaux chez vous seront différents — c'est normal, ils
> dépendent du jour où vous lancez le script. **Ce qui compte, c'est qu'ils
> soient supérieurs à zéro** : cela prouve que la génération de créneaux
> fonctionne réellement.
>
> Si le script s'arrête sur « Aucun compte trouvé pour … », c'est que l'email de
> l'étape 5 ne correspond pas à celui de l'étape 4.

---

## Étape 6 — Récupérer les deux clés

1. Barre latérale, tout en bas → **Project Settings** (icône engrenage) →
   **API** *(selon la version de l'interface, la rubrique peut s'appeler
   **API Keys** ou **Data API**)*.
2. Relevez deux valeurs :
   - **Project URL** — de la forme `https://abcdefgh.supabase.co`
   - **anon / public** — une longue chaîne commençant par `eyJ…`

> ⚠️ Il y a aussi une clé **`service_role`** sur cette page.
> **Ne la copiez jamais dans l'application** : elle contourne toutes les règles
> de sécurité. Seule la clé `anon` va dans le code — elle est publique par
> conception, et ce sont les politiques RLS installées à l'étape 2 qui protègent
> les données.

---

## Étape 7 — Lancer l'application

Dans un terminal, sur votre machine :

```bash
git clone https://github.com/medsamet/Coiffrdv.git
cd Coiffrdv
npm install

cd apps/mobile
cp .env.example .env
```

Ouvrez le fichier `.env` dans un éditeur de texte et collez vos deux valeurs :

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Puis :

```bash
npx expo start
```

Quand le QR code s'affiche, appuyez sur la touche **`w`** : l'application
s'ouvre dans votre navigateur.

Connectez-vous avec l'email et le mot de passe de l'étape 4 → vous arrivez sur
le **tableau de bord du coiffeur**.

Pour voir le côté client, créez un second compte depuis l'écran
« Créer un compte » de l'application : il sera automatiquement un compte client.

---

## Si quelque chose ne va pas

| Symptôme | Cause la plus probable |
|---|---|
| `Configuration manquante` au démarrage | Le fichier `.env` est mal placé (il va dans `apps/mobile/`) ou les valeurs sont vides |
| Écran de connexion en boucle | « Confirm email » est resté activé (étape 3) |
| Connecté mais écran vide | La table `profiles` est vide → l'étape 2 n'a pas abouti |
| « Aucun créneau ce jour-là » partout | Normal le dimanche et le lundi : le salon est fermé. Essayez un mardi |
| Le coiffeur voit l'espace client | L'étape 5 n'a pas été lancée, ou pas avec le bon email |

En cas de doute, envoyez-moi le message d'erreur exact : ils sont tous rédigés
en français et disent quoi faire.
