# 📦 Suivi Commandes — SNCF Réseau

Réception des bons de livraison par les agents de terrain (smartphone / PC).
Les lignes de commande **et** le pointage sont dans Supabase (table `commandes_lignes`).

## Fonctionnement

```
Admin SNCF                              Agents terrain
──────────                              ──────────────
Onglet « Import & Liste »               Ouvrent l'appli (smartphone)
Choisit un Excel / CSV          →→→→→   Voient les BL de leur EE
Aperçu : +nouvelles / ~modifiées        Cochent les lignes reçues
Valide                                  Saisissent les observations
                                        → enregistré en base, visible de tous
```

- **Complément de liste** : nouvelles lignes ajoutées, lignes existantes mises à jour,
  pointage conservé, aucune ligne supprimée.
- **Pointage** : enregistré à chaque coche / observation. Sans réseau, il est gardé sur le
  téléphone (badge ⏳ en haut) et part dès que le réseau revient (badge ✓).
- Les agents voient uniquement les lignes de leur EE ; SNCF voit tout.

## Mise en place (une seule fois)

1. Supabase → SQL Editor → exécuter `supabase.sql`
2. Déployer ce dossier sur GitHub Pages
3. Se connecter en SNCF → onglet **Import & Liste** → importer `data/liste_commandes.csv`
   (le fichier de départ, 681 lignes déjà reçues sont reprises comme reçues)

## Colonnes reconnues (Excel ou CSV, séparateur `,` `;` ou tabulation)

`N° DM · LIGNE · N°BL · Article · Quantité · CHANTIER · Date livraison · INTITULER · EE · RECEPTION`

Seules `N°BL` et `Article` sont obligatoires.

## Structure

```
index.html · manifest.json · supabase.sql
css/style.css
js/auth.js          accès par e-mail (table app_bob)
js/state.js         données, pointage, synchro Supabase, file d'attente hors ligne
js/import.js        chargement de la liste depuis Supabase
js/import_custom.js import Excel/CSV = complément de la base (admin)
js/render.js · export.js · app.js · ui.js
```
