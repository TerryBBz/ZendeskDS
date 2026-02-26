# Copilot Instructions — ZendeskDS

## Projet
Application web de création de templates HTML pour Zendesk.
Hébergée sur Cloudflare Pages, stockage via File System Access API (Chrome/Edge) + fallback localStorage.

## Stack
- **Frontend** : Vite, CodeMirror 6, SortableJS
- **Stockage** : File System Access API (fichiers JSON locaux) ou localStorage
- **Hébergement** : Cloudflare Pages (deploy auto sur push main)
- **CI/CD** : GitHub Actions → Cloudflare Pages

## Commandes utiles
```bash
npm run dev           # Dev navigateur (localhost:5173)
npm run build         # Build production
npm run preview       # Preview du build local
```

## Déploiement
Push sur `main` → GitHub Actions build + deploy automatique sur Cloudflare Pages.

## Architecture
```
src/
├── main.js            # Point d'entrée, tabs, toast, folder access banner
├── builder.js         # Éditeur de composants (CodeMirror)
├── assembler.js       # Assembleur de templates (drag & drop)
├── storage.js         # Stockage dual-mode (File System Access API / localStorage)
├── categories.js      # Catégories de composants
├── defaults.js        # Composants par défaut (premier lancement)
├── style-toolbar.js   # Toolbar WYSIWYG
└── style.css
.github/workflows/     # CI/CD deploy Cloudflare Pages
```

## Conventions
- Toutes les fonctions de `storage.js` sont **async**
- File System Access API : l'utilisateur choisit un dossier, le handle est persisté dans IndexedDB
- Fallback localStorage quand pas de dossier sélectionné
- Fichiers JSON : `components.json`, `templates.json`, `trash.json`
- Compatible Chrome et Edge (File System Access API)

## Repo GitHub
- **Compte** : TerryBBz
- **Repo** : TerryBBz/ZendeskDS (public)
- **Remote** : origin → https://github.com/TerryBBz/ZendeskDS.git
