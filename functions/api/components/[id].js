export async function onRequestPut(context) {
  const { params, request, env } = context;
  const id = params.id;
  try {
    const comp = await request.json();
    const now = Date.now();

    // Optimistic locking: check updatedAt if provided
    if (comp.updatedAt) {
      const existing = await env.DB.prepare('SELECT updated_at FROM components WHERE id = ?').bind(id).first();
      if (existing && existing.updated_at !== comp.updatedAt) {
        return new Response(JSON.stringify({ error: 'conflict', message: 'Ce composant a été modifié par quelqu\'un d\'autre' }), {
          status: 409, headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Save version before updating
    try {
      const prev = await env.DB.prepare('SELECT name, category, html, tags FROM components WHERE id = ?').bind(id).first();
      if (prev) {
        await env.DB.prepare(
          'INSERT INTO component_versions (component_id, name, category, html, tags, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, prev.name, prev.category, prev.html, prev.tags || '[]', now).run();
        // Keep only last 20 versions
        await env.DB.prepare(
          'DELETE FROM component_versions WHERE component_id = ? AND id NOT IN (SELECT id FROM component_versions WHERE component_id = ? ORDER BY created_at DESC LIMIT 20)'
        ).bind(id, id).run();
      }
    } catch (_) { /* version table may not exist yet */ }

    const tags = JSON.stringify(comp.tags || []);
    const result = await env.DB.prepare(
      'UPDATE components SET name = ?, category = ?, html = ?, favorite = ?, folder_id = ?, tags = ?, updated_at = ? WHERE id = ?'
    ).bind(comp.name, comp.category || 'other', comp.html, comp.favorite ? 1 : 0, comp.folderId || null, tags, now, id).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Composant introuvable' }), {
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
  const id = params.id;
  try {
    // Move to trash before deleting
    const comp = await env.DB.prepare('SELECT * FROM components WHERE id = ?').bind(id).first();
    if (comp) {
      await env.DB.prepare(
        'INSERT INTO trash (id, name, category, html, favorite, folder_id, tags, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(comp.id, comp.name, comp.category, comp.html, comp.favorite, comp.folder_id, comp.tags || '[]', comp.created_at, comp.updated_at, Date.now()).run();
    }
    await env.DB.prepare('DELETE FROM components WHERE id = ?').bind(id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
