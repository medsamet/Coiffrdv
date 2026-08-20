# Choix technique

Décision prise le 19 août 2026, validée par le porteur du projet.

## Le besoin, en une phrase

Une application **web, iOS et Android** pour un salon, développée et maintenue par
une petite équipe, dont la contrainte centrale est de ne **jamais** attribuer deux
fois le même créneau.

## La décision

**Expo (React Native) pour les applications, Supabase (PostgreSQL) pour le serveur.**

| Couche | Choix | Pourquoi celui-là |
|---|---|---|
| Applications | Expo SDK + Expo Router, TypeScript | Un seul code pour les trois plateformes. React Native Web rend le même arbre de composants dans un navigateur : les écrans web et mobile de la maquette partagent l'essentiel de leur implémentation. |
| Publication | EAS Build | Compile et soumet sur l'App Store et le Play Store sans Mac ni Xcode local. Les correctifs partent en OTA, sans repasser par la validation d'Apple. |
| Serveur & base | Supabase — PostgreSQL managé | Voir ci-dessous : c'est le point décisif. |
| Authentification | Supabase Auth | Gère nativement l'inscription **par email et par téléphone**, la vérification par code, la réinitialisation. Exactement le besoin, sans écrire de code de sécurité maison. |
| Cloisonnement | Row Level Security | Les règles « un client ne voit que ses rendez-vous » vivent dans la base, pas dans l'application. |
| Temps réel | Supabase Realtime | Les nouvelles demandes apparaissent sur l'écran du coiffeur sans rafraîchir. |
| Emails / SMS | Resend (email) + un agrégateur SMS local, via Edge Function | Découplés du métier par la table `notifications_outbox`. |

## Le point qui a tranché : PostgreSQL

La règle la plus importante du produit est une règle de **non-chevauchement**. En
PostgreSQL, elle s'écrit ainsi :

```sql
exclude using gist (salon_id with =, during with &&) where (status = 'confirmed')
```

Une ligne. Et à partir de là, la double réservation est **structurellement impossible** :
même si deux clients valident à la même milliseconde, même si un développeur oublie
une vérification, même si quelqu'un écrit directement en base, le moteur refuse.

C'est ce qu'aucune base NoSQL ne sait faire. Avec Firestore, il aurait fallu une
transaction applicative, un verrou par créneau, et vivre avec le risque résiduel —
pour la règle qui, si elle casse, fait qu'un client se déplace pour rien.

Le test `supabase/tests/01_business_rules_test.sql` (groupe 5) tente précisément
cette écriture directe et vérifie que le moteur la rejette.

## Ce qu'on a écarté, et pourquoi

**Flutter + Firebase.** Excellent en mobile, et Dart est agréable. Deux objections :
le rendu web de Flutter est lourd et mal référencé par Google, ce qui pénalise la
page vitrine du salon ; et Firestore complique exactement la règle qui compte le plus
(voir ci-dessus).

**Next.js pour le web + React Native pour le mobile, séparés.** Meilleur référencement,
mais deux bases de code à faire évoluer en parallèle — pour une petite équipe, c'est
le meilleur moyen de voir le mobile prendre du retard sur le web.

**Backend maison (Node/Express ou Laravel) + Postgres.** Donne le contrôle total, mais
il faudrait réécrire l'authentification email/téléphone, la gestion des sessions, le
temps réel, et héberger tout ça. Plusieurs semaines de travail pour retrouver ce que
Supabase donne au démarrage, sans le gagner en robustesse.

## Le point encore ouvert : le référencement

Si le salon veut apparaître dans les résultats Google, la page vitrine gagnerait à
être une page statique (Astro ou Next.js) à côté de l'application Expo — une
demi-journée de travail, aucun impact sur le reste. À décider quand la question se
posera vraiment.

## Coût

| Poste | Démarrage | Production |
|---|---|---|
| Supabase | gratuit | ~25 $/mois |
| EAS Build | gratuit (quota limité) | ~19 $/mois si besoin |
| Emails (Resend) | gratuit jusqu'à 3 000/mois | ~20 $/mois |
| SMS | — | ~0,03–0,05 DT par message |
| Compte développeur Apple | — | 99 $/an |
| Compte développeur Google | — | 25 $ une fois |

Le coût des SMS mérite une décision : les envoyer à tout le monde, ou les réserver à
la vérification du compte et passer ensuite par des notifications push (gratuites)
pour les clients qui ont installé l'application. La seconde option divise la facture
par dix et sera proposée par défaut.

## Organisation du code

```
packages/core/    Règles partagées, sans dépendance à React ni à Supabase.
                  Testables en isolation, réutilisables partout.
supabase/         Le schéma ET la logique métier. La base fait autorité.
apps/mobile/      L'interface — web, iOS, Android.
```

Le principe est constant : **ce qui décide vit dans la base**. L'application affiche,
guide, anticipe les refus pour ne pas envoyer l'utilisateur dans le mur — mais elle
ne protège rien. Un client modifié n'obtient rien de plus qu'un client normal.
