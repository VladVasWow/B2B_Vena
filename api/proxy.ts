// Vercel Edge Function — серверний проксі до 1C OData (обходить CORS)
// URL: /api/proxy?path=<resource>&<odata-params>
// Методи: GET, POST, PATCH

export const config = { runtime: 'edge' };

const BASE =
  process.env.ODATA_BASE_URL ??
  'https://1csync.mailcn.com.ua:9443/VenaCentr/odata/standard.odata';

// btoa замість Buffer — Edge runtime не має Node.js API
const CREDENTIALS = btoa(
  `${process.env.ODATA_LOGIN ?? 'website'}:${process.env.ODATA_PASSWORD ?? 'ty4hD65G7T'}`
);

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';
  const method = request.method.toUpperCase();

  if (method === 'GET') {
    // Зберігаємо raw query (щоб не кодувати guid'value' повторно)
    const rawQuery = url.search.slice(1);
    const query = rawQuery
      .split('&')
      .filter((p) => !p.startsWith('path='))
      .map((p) => {
        const eq = p.indexOf('=');
        if (eq === -1) return p;
        return p.slice(0, eq) + '=' + decodeURIComponent(p.slice(eq + 1));
      })
      .join('&');

    const targetUrl = `${BASE}/${path}${query ? '?' + query : ''}`;

    const response = await fetch(targetUrl, {
      headers: {
        Authorization: `Basic ${CREDENTIALS}`,
        Accept: 'application/json',
      },
    });

    const text = await response.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    return Response.json(data, { status: response.status });
  }

  if (method === 'POST' || method === 'PATCH') {
    const targetUrl = `${BASE}/${path}?$format=json`;
    const body = await request.text();

    const response = await fetch(targetUrl, {
      method,
      headers: {
        Authorization: `Basic ${CREDENTIALS}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
    });

    const text = await response.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    return Response.json(data, { status: response.status });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
