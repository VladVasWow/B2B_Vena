// Expo Router API Route — виконується на сервері, немає CORS
// URL: /api/proxy?path=Catalog_КатегорииТоваров&...

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

  const targetUrl = `https://1csync.mailcn.com.ua:9443/VenaCentr/odata/standard.odata/${path}${query ? '?' + query : ''}`;
  console.log('[proxy] →', targetUrl);

  const credentials = Buffer.from('website:ty4hD65G7T').toString('base64');

  const response = await fetch(targetUrl, {
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  console.log('[proxy] status:', response.status, text.slice(0, 500));

  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { error: text }; }

  return Response.json(data, { status: response.status });
}
