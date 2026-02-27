async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createToken(payload, secret) {
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64url(sig)}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { password } = await request.json();
    if (!password) {
      return new Response(JSON.stringify({ error: 'Mot de passe requis' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const hash = await hashPassword(password);

    if (hash !== env.PASSWORD_HASH) {
      return new Response(JSON.stringify({ error: 'Mot de passe incorrect' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Token valid 24h
    const token = await createToken(
      { iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 },
      env.PASSWORD_HASH
    );

    return new Response(JSON.stringify({ token }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Requête invalide' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
