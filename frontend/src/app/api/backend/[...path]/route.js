const BACKEND_URL = 'https://farmersetu-production.up.railway.app';

function makeHeaders(request) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('connection');
  headers.delete('origin');
  headers.delete('referer');
  return headers;
}

async function send(target, method, headers, body) {
  return fetch(target, {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : body,
    redirect: 'manual',
    cache: 'no-store',
  });
}

function copyResponse(response, body = response.body) {
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

async function proxy(request, { params }) {
  const resolvedParams = await params;
  const path = Array.isArray(resolvedParams?.path) ? resolvedParams.path.join('/') : '';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': request.headers.get('access-control-request-headers') || 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const query = request.nextUrl.search;
  const target = `${BACKEND_URL}/api/${path}${query}`;
  const headers = makeHeaders(request);
  const body = ['GET', 'HEAD'].includes(request.method) ? null : await request.arrayBuffer();

  try {
    let response = await send(target, request.method, headers, body);

    // Compatibility for older Railway builds that do not yet expose the newer
    // transaction/payment/delete endpoints. All fallbacks use the existing PATCH
    // booking workflow, so the browser remains functional during redeploys.
    if (response.status === 404 && request.method === 'POST') {
      const parts = path.split('/');
      const isEmployeeBookingAction = parts.length === 4 && parts[0] === 'employee' && parts[1] === 'bookings';
      if (isEmployeeBookingAction && ['generate-transaction', 'generate-transact'].includes(parts[3])) {
        const bookingId = encodeURIComponent(parts[2]);
        response = await send(
          `${BACKEND_URL}/api/employee/bookings/${bookingId}`,
          'PATCH',
          new Headers({ ...Object.fromEntries(headers.entries()), 'Content-Type': 'application/json' }),
          new TextEncoder().encode(JSON.stringify({ quality_status: 'Passed' })),
        );
      } else if (isEmployeeBookingAction && ['mark-paid', 'mark-payment', 'paid'].includes(parts[3])) {
        const bookingId = encodeURIComponent(parts[2]);
        const original = body ? new TextDecoder().decode(body) : '{}';
        let payload = {};
        try { payload = JSON.parse(original || '{}'); } catch {}
        response = await send(
          `${BACKEND_URL}/api/employee/bookings/${bookingId}`,
          'PATCH',
          new Headers({ ...Object.fromEntries(headers.entries()), 'Content-Type': 'application/json' }),
          new TextEncoder().encode(JSON.stringify({
            payment_status: 'Paid',
            ...(payload.payment_reference ? { payment_reference: payload.payment_reference } : {}),
          })),
        );
      } else if (isEmployeeBookingAction && parts[3] === 'delete') {
        const bookingId = encodeURIComponent(parts[2]);
        response = await send(
          `${BACKEND_URL}/api/employee/bookings/${bookingId}`,
          'PATCH',
          new Headers({ ...Object.fromEntries(headers.entries()), 'Content-Type': 'application/json' }),
          new TextEncoder().encode(JSON.stringify({ status: 'Cancelled' })),
        );
      }
    }

    if (response.status === 404 && request.method === 'DELETE') {
      const parts = path.split('/');
      if (parts.length === 3 && parts[0] === 'employee' && parts[1] === 'bookings') {
        const bookingId = encodeURIComponent(parts[2]);
        response = await send(
          `${BACKEND_URL}/api/employee/bookings/${bookingId}`,
          'PATCH',
          new Headers({ ...Object.fromEntries(headers.entries()), 'Content-Type': 'application/json' }),
          new TextEncoder().encode(JSON.stringify({ status: 'Cancelled' })),
        );
      }
    }

    // Hide cancelled/soft-deleted bookings from the employee queue.
    if (response.ok && request.method === 'GET' && path === 'employee/bookings') {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          return copyResponse(response, JSON.stringify(data.filter((b) => b?.status !== 'Cancelled')));
        }
      } catch {}
      return copyResponse(response, text);
    }

    return copyResponse(response);
  } catch (error) {
    return Response.json(
      { detail: 'Unable to reach FarmerSetu backend.', error: error?.message || 'Proxy request failed' },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
