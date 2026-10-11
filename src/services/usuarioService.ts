
import { apiRequest } from "./api";
import type { UsuarioRequest } from "../dto/UsuarioRequest";
import type { UsuarioResponse } from "../dto/UsuarioResponse";

export async function registrarUsuario(
  usuario: UsuarioRequest
): Promise<UsuarioResponse> {
  return apiRequest<UsuarioResponse>(
    "/api/usuarios",
    "POST",
    usuario
  );
}

export async function obtenerMiUsuario(
  token: string
): Promise<UsuarioResponse> {
  return apiRequest<UsuarioResponse>(
    "/api/usuarios/me",
    "GET",
    undefined,
    token
  );
}

export async function obtenerUsuario(
  id: number,
  token: string
): Promise<UsuarioResponse> {
  return apiRequest<UsuarioResponse>(
    `/api/usuarios/${id}`,
    "GET",
    undefined,
    token
  );
}

export async function listarUsuarios(
  token: string
): Promise<UsuarioResponse[]> {
  return apiRequest<UsuarioResponse[]>(
    "/api/usuarios",
    "GET",
    undefined,
    token
  );
}

export async function desactivarUsuario(
  id: number,
  token: string
): Promise<void> {
  return apiRequest<void>(
    `/api/usuarios/${id}`,
    "DELETE",
    undefined,
    token
  );
}
