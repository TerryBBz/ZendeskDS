export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare('SELECT key, label, icon, color FROM folders ORDER BY key').all();
    const folders = {};
    for (const row of results) {
      folders[row.key] = { label: row.label, icon: row.icon, color: row.color };
    }
    return new Response(JSON.stringify(folders), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// PUT /api/folders — replace all folders
export async function onRequestPut(context) {
  const { request, env } = context;
  try {
    const folders = await request.json();
    await env.DB.prepare('DELETE FROM folders').run();
    const stmt = env.DB.prepare('INSERT INTO folders (key, label, icon, color) VALUES (?, ?, ?, ?)');
    const batch = Object.entries(folders).map(([key, f]) =>
      stmt.bind(key, f.label, f.icon || '📁', f.color || '#b2bec3')
    );
    if (batch.length > 0) await env.DB.batch(batch);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
