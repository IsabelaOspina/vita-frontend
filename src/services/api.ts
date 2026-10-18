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

/**
 * Las consultas (GET) se guardan en memoria unos segundos: al volver a una pantalla o pasar de
 * "Mi salud" a "Hoy", los datos se muestran al instante sin volver a preguntarle al servidor.
 * En cuanto se crea, edita o cancela algo, todo lo guardado se descarta para no mostrar datos viejos.
 */
const VIGENCIA_MS = 15_000;

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

type Respuesta = { ok: boolean; status: number; texto: string };

/** Respuestas recientes de consultas (GET), por token y dirección. Se guarda el texto para devolver copias. */
const guardadas = new Map<string, { hasta: number; respuesta: Respuesta }>();
/** Consultas que van en camino: si otra pantalla pide lo mismo al tiempo, comparte la misma petición. */
const enCamino = new Map<string, Promise<Respuesta>>();

/** Sube cada vez que cambian datos: una consulta que salió antes del cambio no se guarda. */
let generacion = 0;

/** Descarta las consultas guardadas (se llama sola después de crear, editar o cancelar algo). */
export function olvidarConsultasGuardadas() {
  generacion++;
  guardadas.clear();
  enCamino.clear();
}

async function pedir(endpoint: string, method: string, body: object | undefined, token: string | undefined): Promise<Respuesta> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ESPERA_MAXIMA_MS);

  try {
    const respuesta = await fetch(`${API_URL}${endpoint}`, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: control.signal,
    });
    const texto = respuesta.status === 204 ? "" : await respuesta.text();
    return { ok: respuesta.ok, status: respuesta.status, texto };
  } catch (e) {
    if (control.signal.aborted) throw new TiempoAgotadoError();
    throw e;
  } finally {
    clearTimeout(temporizador);
  }
}

/** Para las consultas (GET): usa la respuesta guardada si es reciente, o la petición que ya va en camino. */
async function consultar(endpoint: string, token: string | undefined): Promise<Respuesta> {
  const clave = `${token ?? ""} ${endpoint}`;
  const guardada = guardadas.get(clave);
  if (guardada && guardada.hasta > Date.now()) return guardada.respuesta;

  const pendiente = enCamino.get(clave);
  if (pendiente) return pendiente;

  const generacionAlSalir = generacion;
  const peticion = pedir(endpoint, "GET", undefined, token)
      .then((respuesta) => {
        // Solo se guardan las respuestas correctas (los errores se vuelven a intentar) y que no
        // hayan quedado viejas por un cambio mientras iban en camino
        if (respuesta.ok && generacionAlSalir === generacion) {
          guardadas.set(clave, { hasta: Date.now() + VIGENCIA_MS, respuesta });
        }
        return respuesta;
      })
      .finally(() => {
        if (enCamino.get(clave) === peticion) enCamino.delete(clave);
      });
  enCamino.set(clave, peticion);
  return peticion;
}

export async function apiRequest<T>(
    endpoint: string,
    method: string = "GET",
    body?: object,
    token?: string
): Promise<T> {
  const respuesta = method === "GET" ? await consultar(endpoint, token) : await pedir(endpoint, method, body, token);

  // Algo cambió en el backend: se descartan las consultas guardadas y el vigilante vuelve a
  // programar los avisos del celular de inmediato
  if (respuesta.ok && method !== "GET") {
    olvidarConsultasGuardadas();
    datosCambiaron();
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  const texto = respuesta.texto;

  // Se interpreta el texto cada vez: así cada pantalla recibe su propia copia de los datos
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