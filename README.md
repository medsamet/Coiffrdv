# Coiff'RDV

Prise de rendez-vous chez le coiffeur — **web, iOS et Android** depuis une seule base de code.

Deux rôles : le **client** demande un créneau, le **coiffeur** définit ses disponibilités,
ses prestations et ses tarifs, puis valide ou refuse chaque demande.

> Salon de démonstration : Coupe & Style, La Marsa (Tunis). Montants en **dinars tunisiens**.

---

## Où en est le projet

| Étape | État |
|---|---|
| Maquettes web + mobile | ✅ validées ([`maquettes/`](maquettes/)) |
| Choix technique | ✅ arrêté ([`docs/02-choix-technique.md`](docs/02-choix-technique.md)) |
| Schéma de base + règles métier SQL | ✅ écrit et testé (11 groupes de règles) |
| Cœur métier TypeScript partagé | ✅ écrit et testé (46 tests) |
| Application Expo (web + mobile) | 🚧 en cours |
| Envoi réel des emails / SMS | ⬜ à faire |

---

## Les règles du jeu

Ce ne sont pas des intentions : chacune est vérifiée par un test.

- Un client s'inscrit par **email ou par téléphone** — un seul des deux suffit, et c'est
  ce canal qui reçoit ensuite ses notifications.
- Quatre prestations : **Barbe**, **Cheveux**, **Barbe + Cheveux**, **Coupe enfant**.
  Le coiffeur fixe pour chacune sa **durée** et son **tarif** ; la grille de créneaux
  proposée aux clients en découle directement.
- Le client envoie une **demande**, jamais une réservation ferme. Tant que le coiffeur
  n'a pas tranché, le créneau reste proposé aux autres — c'est lui qui arbitre.
- **Deux rendez-vous confirmés ne peuvent pas se chevaucher.** Ce n'est pas une
  vérification applicative qu'on pourrait oublier quelque part : c'est une contrainte
  d'exclusion PostgreSQL. Deux clics simultanés sur le dernier créneau, et le second
  est refusé par le moteur.
- Le coiffeur peut **bloquer** n'importe quel créneau, poser des pauses récurrentes,
  fermer une journée entière.
- Le client peut **annuler** jusqu'à un délai qu'il fixe (2 h par défaut).
  Le coiffeur, lui, annule quand il veut.
- Chaque changement de statut dépose une **notification** dans une file d'attente,
  envoyée ensuite par email ou par SMS selon le compte.

## Ce que contient le dépôt

```
maquettes/          Les deux maquettes validées, à ouvrir dans un navigateur
docs/               Spécification, choix technique, modèle de données, mise en route
supabase/
  migrations/       Le schéma et toute la logique métier (PostgreSQL)
  tests/            Les tests des règles métier, en SQL pur
  seed.sql          Jeu de démonstration
packages/core/      Règles partagées TypeScript (argent, temps, statuts) + tests
apps/mobile/        Application Expo — web, iOS, Android
```

## Démarrer

```bash
# 1. Les tests du cœur métier TypeScript (aucune dépendance externe)
npm install && npm test

# 2. Les tests des règles métier sur une vraie base PostgreSQL
npm run test:db

# 3. L'application
cd apps/mobile && cp .env.example .env && npx expo start
```

Détails et prérequis : [`docs/04-mise-en-route.md`](docs/04-mise-en-route.md).

### Intégration continue

Le fichier de CI est dans [`docs/ci-workflow.yml`](docs/ci-workflow.yml) et doit être
copié une fois à la main — la connexion GitHub qui a publié ce dépôt n'a pas le droit
d'écrire sous `.github/workflows/` :

```bash
mkdir -p .github/workflows && cp docs/ci-workflow.yml .github/workflows/ci.yml
```

## Licence

MIT.
