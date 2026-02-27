export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, blocks, created_at AS createdAt, updated_at AS updatedAt FROM templates ORDER BY name'
    ).all();
    return new Response(JSON.stringify(results.map(r => ({ ...r, blocks: JSON.parse(r.blocks || '[]') }))), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const tpl = await request.json();
    if (!tpl.id || !tpl.name) {
      return new Response(JSON.stringify({ error: 'Champs requis: id, name' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO templates (id, name, blocks, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(tpl.id, tpl.name, JSON.stringify(tpl.blocks || []), tpl.createdAt || now, now).run();

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
