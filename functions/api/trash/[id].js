// POST /api/trash/:id — restore from trash
export async function onRequestPost(context) {
  const { params, env } = context;
  const id = params.id;
  try {
    const item = await env.DB.prepare('SELECT * FROM trash WHERE id = ?').bind(id).first();
    if (!item) {
      return new Response(JSON.stringify({ error: 'Élément introuvable dans la corbeille' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO components (id, name, category, html, favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(item.id, item.name, item.category, item.html, item.favorite, item.created_at, now).run();
    await env.DB.prepare('DELETE FROM trash WHERE id = ?').bind(id).run();

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// DELETE /api/trash/:id — permanently delete from trash
export async function onRequestDelete(context) {
  const { params, env } = context;
  try {
    await env.DB.prepare('DELETE FROM trash WHERE id = ?').bind(params.id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
