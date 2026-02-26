import { getComponents, saveComponent } from './storage.js';

const DEFAULTS_LOADED_KEY = 'ztb-defaults-loaded';

const defaultComponents = [
  {
    id: 'default-header',
    name: 'En-tête article',
    category: 'header',
    html: `<div style="padding: 24px 0; border-bottom: 2px solid #e0e0e0; margin-bottom: 24px;">
  <h1 style="font-size: 24px; color: #2d3436; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Titre de l'article</h1>
  <p style="font-size: 14px; color: #636e72; margin: 0;">Dernière mise à jour : XX/XX/XXXX</p>
</div>`
  },
  {
    id: 'default-info-callout',
    name: 'Callout Info',
    category: 'callout',
    html: `<div style="background: #dfe6e9; border-left: 4px solid #0984e3; padding: 16px 20px; border-radius: 4px; margin: 16px 0;">
  <p style="margin: 0; font-size: 14px; color: #2d3436; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <strong>ℹ️ Information :</strong> Votre texte informatif ici.
  </p>
</div>`
  },
  {
    id: 'default-warning-callout',
    name: 'Callout Attention',
    category: 'callout',
    html: `<div style="background: #ffeaa7; border-left: 4px solid #fdcb6e; padding: 16px 20px; border-radius: 4px; margin: 16px 0;">
  <p style="margin: 0; font-size: 14px; color: #2d3436; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <strong>⚠️ Attention :</strong> Point important à noter.
  </p>
</div>`
  },
  {
    id: 'default-steps',
    name: 'Étapes numérotées',
    category: 'list',
    html: `<div style="margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
    <span style="background: #0984e3; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">1</span>
    <div style="font-size: 14px; color: #2d3436; padding-top: 4px;">Première étape de la procédure.</div>
  </div>
  <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
    <span style="background: #0984e3; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">2</span>
    <div style="font-size: 14px; color: #2d3436; padding-top: 4px;">Deuxième étape de la procédure.</div>
  </div>
  <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
    <span style="background: #0984e3; color: white; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; margin-right: 12px; flex-shrink: 0;">3</span>
    <div style="font-size: 14px; color: #2d3436; padding-top: 4px;">Troisième étape de la procédure.</div>
  </div>
</div>`
  },
  {
    id: 'default-paragraph',
    name: 'Paragraphe',
    category: 'content',
    html: `<p style="font-size: 14px; line-height: 1.6; color: #2d3436; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  Votre texte ici. Vous pouvez ajouter du contenu détaillé pour expliquer une fonctionnalité, une procédure ou toute autre information utile pour vos utilisateurs.
</p>`
  },
  {
    id: 'default-separator',
    name: 'Séparateur',
    category: 'other',
    html: `<hr style="border: none; border-top: 1px solid #dfe6e9; margin: 24px 0;" />`
  },
  {
    id: 'default-image-block',
    name: 'Bloc image + légende',
    category: 'content',
    html: `<div style="margin: 16px 0; text-align: center;">
  <img src="https://via.placeholder.com/600x300/dfe6e9/636e72?text=Capture+d%27%C3%A9cran" alt="Description de l'image" style="max-width: 100%; border: 1px solid #dfe6e9; border-radius: 4px;" />
  <p style="font-size: 12px; color: #636e72; margin-top: 8px; font-style: italic; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Légende de l'image</p>
</div>`
  },
  {
    id: 'default-footer',
    name: 'Pied de page article',
    category: 'footer',
    html: `<div style="border-top: 1px solid #dfe6e9; padding-top: 20px; margin-top: 32px;">
  <p style="font-size: 13px; color: #636e72; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    📩 Besoin d'aide supplémentaire ? <a href="#" style="color: #0984e3; text-decoration: none;">Contactez notre support</a>
  </p>
</div>`
  }
];

export function loadDefaultComponents() {
  if (localStorage.getItem(DEFAULTS_LOADED_KEY)) return;

  const existing = getComponents();
  if (existing.length > 0) {
    localStorage.setItem(DEFAULTS_LOADED_KEY, '1');
    return;
  }

  defaultComponents.forEach(comp => saveComponent(comp));
  localStorage.setItem(DEFAULTS_LOADED_KEY, '1');
}
