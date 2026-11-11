export const dynamic = "force-dynamic";

// Memoria en caliente para el endpoint que responde exitosamente (evita reintentos lentos)
let activeBackendUrl = null;

async function handleRequest(request) {
  // Lista ordenada de posibles endpoints del backend
  const candidateTargets = [
    activeBackendUrl,
    process.env.INTERNAL_BACKEND_URL,
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://backend:8000",
    "http://innovait_sales_backend:8000",
    "http://host.docker.internal:8000",
    "http://172.17.0.1:8000",
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
      // Ajuste dinámico de timeout:
      // Para síntesis de voz (TTS) o simulación con IA, se conceden hasta 25s para no interrumpir el audio neuronal.
      // Si ya conocemos el backend activo, se conceden hasta 15s. Para sondeo inicial de IPs desconocidas, 3.5s.
      const isTTSOrSim = incomingPath.includes("/voice/tts") || incomingPath.includes("/simulate");
      const isKnownActive = activeBackendUrl && backend === activeBackendUrl;
      const timeoutMs = isTTSOrSim ? 25000 : (isKnownActive ? 15000 : 3500);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(targetUrl, {
        method,
        headers: forwardHeaders,
        body: bodyData,
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Si respondió con éxito, recordamos este backend como el activo
      activeBackendUrl = backend;

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
      // Si el backend que teníamos guardado falló, lo reseteamos para buscar de nuevo
      if (activeBackendUrl === backend) {
        activeBackendUrl = null;
      }
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
