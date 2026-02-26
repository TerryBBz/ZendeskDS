# Copilot Instructions — ZendeskDS

## Projet
Application desktop (Tauri v2) de création de templates HTML pour Zendesk.
Frontend Vite + vanilla JS, stockage fichiers JSON dans `Documents/ZendeskDS/`.

## Stack
- **Frontend** : Vite, CodeMirror 6, SortableJS
- **Desktop** : Tauri v2 (Rust)
- **Stockage** : Fichiers JSON (`components.json`, `templates.json`, `trash.json`) — PAS de base de données
- **CI/CD** : GitHub Actions

## Commandes utiles
```bash
npm run dev           # Dev navigateur (localhost:5173)
npm run tauri:dev     # Dev app desktop Tauri
npm run build         # Build Vite uniquement
npm run tauri:build   # Build app desktop (.dmg / .exe)
```

## Release
Pour publier une nouvelle version :
```bash
# 1. Mettre à jour la version dans tauri.conf.json et package.json
# 2. Commit
git add -A && git commit -m "release: vX.Y.Z"
# 3. Tag et push
git tag vX.Y.Z && git push origin main --tags
```
GitHub Actions build automatiquement les binaires Windows (.exe) et Mac (.dmg) et les publie dans l'onglet Releases.

## Architecture
```
src/
├── main.js            # Point d'entrée, tabs, toast
├── builder.js         # Éditeur de composants (CodeMirror)
├── assembler.js       # Assembleur de templates (drag & drop)
├── storage.js         # Stockage dual-mode (Tauri FS / localStorage)
├── categories.js      # Catégories de composants
├── defaults.js        # Composants par défaut (premier lancement)
├── style-toolbar.js   # Toolbar WYSIWYG
└── style.css
src-tauri/             # Backend Rust Tauri
.github/workflows/     # CI/CD release
```

## Conventions
- Toutes les fonctions de `storage.js` sont **async**
- Les données utilisateur sont dans `~/Documents/ZendeskDS/` (jamais dans l'app)
- Chaque fichier JSON contient `_version` pour permettre les migrations futures
- L'app fonctionne aussi en mode navigateur (fallback localStorage)

## Repo GitHub
- **Compte** : TerryBBz
- **Repo** : TerryBBz/ZendeskDS (privé)
- **Remote** : origin → git@github.com:TerryBBz/ZendeskDS.git
