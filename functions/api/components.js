export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, category, html, favorite, folder_id AS folderId, created_at AS createdAt, updated_at AS updatedAt FROM components ORDER BY name'
    ).all();
    return new Response(JSON.stringify(results.map(r => ({ ...r, favorite: !!r.favorite }))), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const comp = await request.json();
    if (!comp.id || !comp.name || !comp.html) {
      return new Response(JSON.stringify({ error: 'Champs requis: id, name, html' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO components (id, name, category, html, favorite, folder_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(comp.id, comp.name, comp.category || 'other', comp.html, comp.favorite ? 1 : 0, comp.folderId || null, comp.createdAt || now, now).run();

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
