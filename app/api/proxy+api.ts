// Expo Router API Route — виконується на сервері, немає CORS
// GET:  /api/proxy?path=<resource>&<odata-params>
// POST: /api/proxy?path=<resource>  body=JSON

const BASE =
  process.env.ODATA_BASE_URL ??
  'https://1csync.mailcn.com.ua:9443/VenaCentr/odata/standard.odata';
const CREDENTIALS = Buffer.from(
  `${process.env.ODATA_LOGIN ?? 'website'}:${process.env.ODATA_PASSWORD ?? 'ty4hD65G7T'}`
).toString('base64');

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';

  // Видаляємо лише path= з raw рядка — НЕ використовуємо searchParams.toString(),
  // бо він повторно кодує ' → %27 і 1С не розпізнає guid'value'
  const rawQuery = url.search.slice(1); // без '?'
  // Декодуємо кожне значення повністю — браузер кодує кирилицю (%D0%9E...),
  // 1С не розпізнає закодовані назви полів ($expand, $select з кирилицею)
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
  console.log('[proxy GET] →', targetUrl);

  const response = await fetch(targetUrl, {
    headers: {
      Authorization: `Basic ${CREDENTIALS}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  console.log('[proxy GET] status:', response.status, text.slice(0, 500));

  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: text }; }

  return Response.json(data, { status: response.status });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';
  const targetUrl = `${BASE}/${path}?$format=json`;

  console.log('[proxy POST] →', targetUrl);

  const body = await request.text();

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${CREDENTIALS}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body,
  });

  const text = await response.text();
  console.log('[proxy POST] status:', response.status, text.slice(0, 500));

  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: text }; }

  return Response.json(data, { status: response.status });
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';
  const targetUrl = `${BASE}/${path}?$format=json`;

  console.log('[proxy PATCH] →', targetUrl);

  const body = await request.text();

  const response = await fetch(targetUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Basic ${CREDENTIALS}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body,
  });

  const text = await response.text();
  console.log('[proxy PATCH] status:', response.status, text.slice(0, 500));

  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: text }; }

  return Response.json(data, { status: response.status });
}
