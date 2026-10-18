import { datosCambiaron } from "../utils/cambios-de-datos";

export class ApiError extends Error {
  status: number;

  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Tiempo máximo de espera de una respuesta. Sin esto, si la conexión se queda colgada, la pantalla
 * se queda "Cargando…" para siempre. Es amplio porque el servidor (Cloud Run) puede tardar unos
 * segundos en arrancar si llevaba un rato sin uso.
 */
const ESPERA_MAXIMA_MS = 30_000;

/** Error cuando el servidor no respondió a tiempo (la pantalla muestra el mensaje y "Intentar de nuevo"). */
export class TiempoAgotadoError extends Error {
  constructor() {
    super("El servidor está tardando en responder. Revisa tu conexión e intenta de nuevo.");
    this.name = "TiempoAgotadoError";
  }
}

if (!API_URL) {
  throw new Error("No se configuró EXPO_PUBLIC_API_URL");
}

export async function apiRequest<T>(
    endpoint: string,
    method: string = "GET",
    body?: object,
    token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${endpoint}`, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: control.signal,
    });
  } catch (e) {
    if (control.signal.aborted) throw new TiempoAgotadoError();
    throw e;
  } finally {
    clearTimeout(temporizador);
  }

  // Algo cambió en el backend: el vigilante vuelve a programar los avisos del celular de inmediato
  if (respuesta.ok && method !== "GET") {
    datosCambiaron();
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  const texto = await respuesta.text();

  let datos: unknown;

  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  if (!respuesta.ok) {
    let mensaje = `Error HTTP ${respuesta.status}`;

    if (typeof datos === "string" && datos.length > 0) {
      mensaje = datos;
    } else if (datos && typeof datos === "object") {
      const error = datos as Record<string, unknown>;

      if (typeof error.mensaje === "string") {
        mensaje = error.mensaje;
      } else if (typeof error.message === "string") {
        mensaje = error.message;
      }
    }

    throw new ApiError(mensaje, respuesta.status);
  }

  return datos as T;
}