export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, category, html, favorite, created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt FROM trash ORDER BY deleted_at DESC'
    ).all();
    return new Response(JSON.stringify(results.map(r => ({ ...r, favorite: !!r.favorite }))), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// DELETE /api/trash — empty trash
export async function onRequestDelete(context) {
  const { env } = context;
  try {
    await env.DB.prepare('DELETE FROM trash').run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
