
import { apiRequest } from "./api";
import type { LoginRequest } from "../dto/LoginRequest";
import type { AuthResponse } from "../dto/AuthResponse";
import { guardarToken } from "../utils/tokenStorage";

export async function iniciarSesion(
  credenciales: LoginRequest
): Promise<AuthResponse> {
  const respuesta = await apiRequest<AuthResponse>(
    "/api/auth/login",
    "POST",
    credenciales
  );

  await guardarToken(respuesta.token);

  return respuesta;
}
