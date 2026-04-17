// Expo Router API Route — image proxy for local dev
// GET: /api/img?path=<filename>  →  http://img.vena.com.ua/web-storage/pict/<filename>

const IMAGE_BASE = 'http://img.vena.com.ua/web-storage/pict/';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';

  if (!path) {
    return new Response('Missing path', { status: 400 });
  }

  const targetUrl = `${IMAGE_BASE}${path}`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return new Response('Image not found', { status: response.status });
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const body = await response.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[img proxy] error:', e);
    return new Response('Failed to fetch image', { status: 502 });
  }
}
