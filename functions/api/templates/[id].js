export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const tpl = await request.json();
    const now = Date.now();

    // Optimistic locking
    if (tpl.updatedAt) {
      const existing = await env.DB.prepare('SELECT updated_at FROM templates WHERE id = ?').bind(id).first();
      if (existing && existing.updated_at !== tpl.updatedAt) {
        return new Response(JSON.stringify({ error: 'conflict', message: 'Ce template a été modifié par quelqu\'un d\'autre' }), {
          status: 409, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const result = await env.DB.prepare(
      'UPDATE templates SET name = ?, blocks = ?, updated_at = ? WHERE id = ?'
    ).bind(tpl.name, JSON.stringify(tpl.blocks || []), now, id).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Template introuvable' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ ok: true, updatedAt: now }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestDelete(context) {
  const { params, env } = context;
  try {
    await env.DB.prepare('DELETE FROM templates WHERE id = ?').bind(params.id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
