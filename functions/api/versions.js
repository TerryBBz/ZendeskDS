export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const componentId = url.searchParams.get('componentId');
  if (!componentId) {
    return new Response(JSON.stringify({ error: 'componentId requis' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, component_id AS componentId, name, category, html, tags, created_at AS createdAt FROM component_versions WHERE component_id = ? ORDER BY created_at DESC LIMIT 20'
    ).bind(componentId).all();
    return new Response(JSON.stringify(results.map(r => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : []
    }))), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  }
}
