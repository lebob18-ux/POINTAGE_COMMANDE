# 📦 Suivi Commandes — SNCF Réseau

Outil de réception des bons de livraison pour agents de terrain.  
Fonctionne dans le navigateur (Android / desktop), aucune installation.

## Principe de fonctionnement

```
Gestionnaire                          Agents terrain
─────────────                         ──────────────
Met à jour                            Ouvrent l'appli
data/liste_commandes.csv    →→→→→→→   ↺ Actualiser
sur GitHub                            Cochent les lignes reçues
                                      Saisissent les observations
                                      Exportent PDF / Excel
```

- **La liste** vient uniquement de `data/liste_commandes.csv` dans le dépôt
- **Les coches et observations** sont sauvegardées localement sur le téléphone de l'agent
- Quand le gestionnaire met à jour le CSV et que l'agent clique ↺ Actualiser :
  - Les nouvelles lignes apparaissent
  - Les lignes supprimées disparaissent
  - Les coches/obs sur les lignes conservées **sont préservées**

## Structure du projet

```
suivi-commandes/
├── index.html
├── manifest.json
├── data/
│   └── liste_commandes.csv   ← À METTRE À JOUR ICI
├── css/
│   └── style.css
└── js/
    ├── state.js
    ├── render.js
    ├── import.js
    ├── export.js
    └── app.js
```

## Format du fichier CSV

Séparateur `;` ou tabulation. En-tête obligatoire.

```
N°DM;LIGNE;N°BL;ARTICLE;INTITULE;QUANTITE
DM_112233;1;BL-2025-042;CAT-FIL-001;Fil caténaire Cu107 mm²;500
```

Pour exporter depuis Excel : **Fichier → Enregistrer sous → CSV (séparateur : point-virgule)**

## Déploiement GitHub Pages

1. Créer un dépôt `suivi-commandes`
2. Pousser ce dossier à la racine
3. **Settings → Pages → Source : `main` / `/ (root)`**
4. URL : `https://<compte>.github.io/suivi-commandes/`

## Mise à jour de la liste

1. Modifier `data/liste_commandes.csv` sur GitHub (édition directe ou commit)
2. Les agents cliquent **↺ Actualiser** — la liste se recharge automatiquement
