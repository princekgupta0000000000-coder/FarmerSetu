const BACKEND_URL = 'https://farmer-setu-backend-qkm8cq802-nexus-7738.vercel.app';

async function proxy(request, { params }) {
  const resolvedParams = await params;
  const path = Array.isArray(resolvedParams?.path) ? resolvedParams.path.join('/') : '';
  // Frontend calls /api/backend/auth/register; FastAPI exposes /api/auth/register.
  const target = `${BACKEND_URL}/api/${path}${request.nextUrl.search}`;

  try {
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('content-length');
    headers.delete('connection');

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    };

    if (!['GET', 'HEAD'].includes(request.method)) {
      init.body = await request.arrayBuffer();
    }

    const response = await fetch(target, init);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return Response.json(
      { detail: 'Unable to reach FarmerSetu backend.', error: error?.message || 'Proxy request failed' },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
