# Spécification fonctionnelle

Version 1 — validée sur les maquettes du 19 août 2026.

## 1. Les deux rôles

Un compte est **soit** client, **soit** coiffeur. Il n'y a pas de double casquette :
le coiffeur ne réserve pas chez lui-même (la fonction `request_appointment` le refuse
explicitement).

### Client
S'inscrit, consulte les prestations, demande un créneau, suit ses rendez-vous,
annule si besoin, consulte son historique.

### Coiffeur
Une seule personne par salon dans cette version. Définit ses horaires, ses pauses,
ses prestations (durée + tarif), bloque des créneaux, valide ou refuse les demandes,
consulte son agenda et sa clientèle.

## 2. Inscription et connexion

L'identifiant est **au choix** une adresse email ou un numéro de téléphone.
L'utilisateur choisit à l'inscription ; un code à 6 chiffres vérifie le canal retenu.

Conséquence sur les notifications : le canal d'inscription devient le canal de
notification par défaut. Un client inscrit par téléphone reçoit des SMS, un client
inscrit par email reçoit des emails. La colonne `profiles.notify_channel` porte ce
choix, et une contrainte garantit qu'on ne peut pas se retrouver avec un canal
sans destination (`profiles_channel_reachable`).

## 3. Les prestations

Quatre types, verrouillés par l'énumération `service_kind` :

| Type | Clé | Durée par défaut | Tarif par défaut |
|---|---|---|---|
| Barbe | `beard` | 15 min | 7 DT |
| Cheveux | `hair` | 30 min | 15 DT |
| Barbe + Cheveux | `beard_hair` | 45 min | 20 DT |
| Coupe enfant | `kids` | 20 min | 10 DT |

Durée, tarif, libellé, description et activation sont **tous** modifiables par le
coiffeur. Les valeurs ci-dessus ne sont que le point de départ du jeu de démonstration.

Chaque prestation porte aussi une **marge de remise en état** (`cleanup_minutes`) :
du temps qui occupe l'agenda sans être facturé ni affiché au client. « Barbe + Cheveux »
dure 45 minutes pour le client, occupe 50 minutes dans l'agenda.

### Effet sur les créneaux
La durée détermine directement la grille proposée. Le pas de la grille
(`slot_step_minutes`, 15 min par défaut) est un réglage du salon, distinct de la durée
des prestations : c'est lui qui décide si l'on propose 09:00, 09:15, 09:30… ou
seulement 09:00, 09:30.

## 4. Disponibilités

Trois niveaux, du plus général au plus ponctuel :

1. **Horaires hebdomadaires** — une plage d'ouverture par jour de la semaine, ou
   « fermé ». Table `opening_hours`.
2. **Pauses récurrentes** — le déjeuner, par exemple. Applicables à un jour précis
   ou à tous les jours ouverts. Table `recurring_breaks`.
3. **Blocages ponctuels** — congés, formation, « je ferme cet après-midi ».
   Une plage d'instants précise. Table `time_blocks`.

Un créneau n'est proposé que si sa plage d'occupation **entière** tient dans les
heures d'ouverture et ne touche aucune de ces indisponibilités. On ne rogne jamais
un créneau : mieux vaut ne pas le proposer que de faire déborder le coiffeur sur
sa pause.

## 5. Le cycle de vie d'un rendez-vous

```
                   demande du client
                          │
                          ▼
                     ┌─────────┐
                     │ pending │◄──── le créneau reste proposé aux autres
                     └────┬────┘
              refus  ┌────┴────┐  validation
                     ▼         ▼
              ┌──────────┐ ┌───────────┐
              │ rejected │ │ confirmed │◄── le créneau disparaît de la grille
              └──────────┘ └─────┬─────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     cancelled_by_client  cancelled_by_barber   completed / no_show
```

Points qui méritent d'être explicites :

- **Une demande en attente ne réserve rien.** Deux clients peuvent demander le même
  créneau ; le back-office affiche alors un avertissement « conflit d'horaire ».
- **Valider une demande refuse automatiquement les demandes concurrentes** qui
  chevauchent le créneau attribué, avec le motif « Créneau attribué à une autre demande ».
- **Le refus peut porter un motif**, transmis tel quel au client dans sa notification.

## 6. Annulation

| Qui | Quand | Effet |
|---|---|---|
| Client, demande en attente | à tout moment | la demande disparaît |
| Client, rendez-vous confirmé | jusqu'à `cancel_deadline_minutes` avant (2 h par défaut) | le créneau est immédiatement rendu à la grille |
| Client, après le délai | refusé — message invitant à appeler le salon | — |
| Coiffeur | à tout moment | le client est notifié |

Le rappel J-1 déjà programmé est retiré de la file d'envoi quand un rendez-vous est
annulé ou refusé : personne ne doit recevoir « à demain ! » pour un rendez-vous qui
n'existe plus.

## 7. Notifications

Aucun email n'est envoyé depuis une transaction métier. Un changement de statut dépose
une ligne dans `notifications_outbox` ; un worker la relève et l'envoie. C'est
rejouable, traçable, et une panne du fournisseur d'emails ne fait pas échouer une
réservation.

| Événement | Destinataire |
|---|---|
| Demande reçue (accusé) | client |
| Nouvelle demande | coiffeur |
| Demande validée | client |
| Demande refusée (+ motif) | client |
| Rappel 24 h avant | client |
| Annulation | l'autre partie |

## 8. Règles de réservation paramétrables

Toutes portées par la table `salons`, modifiables depuis l'écran Disponibilités :

| Réglage | Défaut | Rôle |
|---|---|---|
| `booking_horizon_days` | 60 | Jusqu'à combien de jours à l'avance on peut réserver |
| `min_lead_minutes` | 120 | Délai minimum entre maintenant et le début du rendez-vous |
| `cancel_deadline_minutes` | 120 | Délai d'annulation côté client |
| `slot_step_minutes` | 15 | Pas de la grille de créneaux |
| `auto_confirm_regulars` | non | Valide automatiquement les clients ayant ≥ 3 rendez-vous honorés et aucune annulation tardive |

## 9. Hors périmètre de la version 1

Décidé explicitement, pour éviter les malentendus :

- Pas de **paiement en ligne** — les montants sont affichés, réglés sur place.
- **Un seul coiffeur par salon**. Le schéma est prêt à accueillir plusieurs agendas
  (il suffirait d'une table `staff` et d'une colonne sur `appointments`), mais rien
  n'est développé en ce sens.
- Pas de **programme de fidélité**, pas de **notation**, pas de **photos de coupes**.
- Pas de **liste d'attente** sur créneau complet.
