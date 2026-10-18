import { apiRequest } from "./api";
import type { LoginRequest } from "../dto/LoginRequest";
import type { AuthResponse } from "../dto/AuthResponse";
import type { OlvideContrasenaRequest } from "../dto/OlvideContrasenaRequest";
import type { RestablecerContrasenaRequest } from "../dto/RestablecerContrasenaRequest";
import type { MensajeResponse } from "../dto/MensajeResponse";
import { guardarRol, guardarToken } from "../utils/tokenStorage";

export async function iniciarSesion(
    credenciales: LoginRequest
): Promise<AuthResponse> {
  const respuesta = await apiRequest<AuthResponse>(
      "/api/auth/login",
      "POST",
      credenciales
  );

  await guardarToken(respuesta.token);
  // Con el rol guardado, la próxima vez la app abre directo en la pantalla de la cuenta
  await guardarRol(respuesta.usuario.rol);

  return respuesta;
}

// Olvidé mi contraseña, paso 1: se envía un código de 6 dígitos al correo
// (el backend responde lo mismo exista o no el correo)
export async function solicitarCodigoRecuperacion(
    datos: OlvideContrasenaRequest
): Promise<MensajeResponse> {
  return await apiRequest<MensajeResponse>(
      "/api/auth/olvide-contrasena",
      "POST",
      datos
  );
}

// Olvidé mi contraseña, paso 2: correo + código + nueva contraseña
export async function restablecerContrasena(
    datos: RestablecerContrasenaRequest
): Promise<MensajeResponse> {
  return await apiRequest<MensajeResponse>(
      "/api/auth/restablecer-contrasena",
      "POST",
      datos
  );
}