
import { apiRequest } from "./api";
import type { LoginRequest } from "../dto/LoginRequest";
import type { AuthResponse } from "../dto/AuthResponse";

export async function iniciarSesion(
  credenciales: LoginRequest
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>(
    "/api/auth/login",
    "POST",
    credenciales
  );
}
