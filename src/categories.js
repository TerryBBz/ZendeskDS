export const categories = {
  header:  { label: 'En-tête',       icon: '📌', color: '#0984e3' },
  content: { label: 'Contenu',       icon: '📝', color: '#6c5ce7' },
  callout: { label: 'Callout',       icon: '💡', color: '#fdcb6e' },
  list:    { label: 'Liste',         icon: '📋', color: '#00cec9' },
  footer:  { label: 'Pied de page',  icon: '📎', color: '#636e72' },
  other:   { label: 'Autre',         icon: '🔧', color: '#b2bec3' },
};

export function categoryBadge(categoryKey) {
  const cat = categories[categoryKey] || categories.other;
  return `<span class="category-badge" style="--cat-color: ${cat.color}">${cat.icon} ${cat.label}</span>`;
}
