export const dynamic = "force-dynamic";

async function handleRequest(request) {
  const primaryBackend = process.env.INTERNAL_BACKEND_URL || "http://backend:8000";
  const fallbackBackend = "http://127.0.0.1:8000";

  const targets = [primaryBackend];
  if (primaryBackend !== fallbackBackend) {
    targets.push(fallbackBackend);
  }

  const incomingPath = request.nextUrl.pathname;
  const search = request.nextUrl.search || "";
  const method = request.method;

  // Extraer el cuerpo de la petición si aplica
  let bodyData = null;
  if (method !== "GET" && method !== "HEAD") {
    try {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 0) {
        bodyData = Buffer.from(buffer);
      }
    } catch {
      bodyData = null;
    }
  }

  // Filtrar y preparar encabezados para reenvío seguro
  const forwardHeaders = new Headers();
  request.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k !== "host" && k !== "connection" && k !== "content-length" && k !== "transfer-encoding") {
      forwardHeaders.set(key, value);
    }
  });

  let lastError = null;
  for (const backend of targets) {
    const targetUrl = `${backend.replace(/\/$/, "")}${incomingPath}${search}`;
    try {
      const res = await fetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body: bodyData,
        cache: "no-store",
        redirect: "follow",
      });

      const responseHeaders = new Headers();
      res.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (k !== "content-encoding" && k !== "content-length") {
          responseHeaders.set(key, value);
        }
      });

      const responseBody = await res.arrayBuffer();
      return new Response(responseBody, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      lastError = err;
      // Reintentar con el siguiente endpoint de respaldo si existe
    }
  }

  return new Response(
    JSON.stringify({
      detail: `No se pudo conectar con el backend FastAPI (${targets.join(" o ")}). Motivo: ${lastError?.message || "Servicio no disponible"}`,
      status: 502,
    }),
    {
      status: 502,
      headers: { "Content-Type": "application/json" },
    }
  );
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
export const OPTIONS = handleRequest;
