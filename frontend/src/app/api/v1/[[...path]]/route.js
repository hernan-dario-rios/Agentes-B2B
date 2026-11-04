export const dynamic = "force-dynamic";

async function handleRequest(request) {
  // Lista exhaustiva de endpoints internos ordenados por probabilidad de conexión
  const candidateTargets = [
    process.env.INTERNAL_BACKEND_URL,
    "http://backend:8000",
    "http://innovait_sales_backend:8000",
    "http://host.docker.internal:8000",
    "http://172.17.0.1:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
  ].filter(Boolean);

  const targets = Array.from(new Set(candidateTargets));

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
      const cause = err?.cause?.code || err?.cause?.message || err?.message || "";
      console.error(`[API Proxy] Intento fallido hacia ${targetUrl}: ${err.message} (${cause})`);
    }
  }

  const causeCode = lastError?.cause?.code || lastError?.cause?.message || lastError?.message || "Conexión rechazada";

  return new Response(
    JSON.stringify({
      detail: `No se pudo conectar con el backend FastAPI en ninguna de las rutas internas (${targets.join(", ")}). Causa: ${causeCode}`,
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
