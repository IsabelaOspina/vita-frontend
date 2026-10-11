
export class ApiError extends Error {
  status: number;

  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

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

  const respuesta = await fetch(`${API_URL}${endpoint}`, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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
