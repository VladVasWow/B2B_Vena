export const config = { runtime: 'edge' };

const IMAGE_BASE = 'http://img.vena.com.ua/web-storage/pict/';

export default async function handler(request: Request): Promise<Response> {
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
  } catch {
    return new Response('Failed to fetch image', { status: 502 });
  }
}
