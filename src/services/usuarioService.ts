import { apiRequest } from "./api";

import type { UsuarioRequest } from "../dto/UsuarioRequest";
import type { UsuarioResponse } from "../dto/UsuarioResponse";
import type { AsignacionResponse } from "../dto/AsignacionResponse";
import type { CambiarContrasenaRequest } from "../dto/CambiarContrasenaRequest";

// Registrar un usuario
export async function registrarUsuario(
  usuario: UsuarioRequest
): Promise<UsuarioResponse> {
  return await apiRequest<UsuarioResponse>(
    "/api/usuarios",
    "POST",
    usuario
  );
}

// Consultar el perfil del usuario que inició sesión
export async function obtenerMiUsuario(
  token: string
): Promise<UsuarioResponse> {
  return await apiRequest<UsuarioResponse>(
    "/api/usuarios/me",
    "GET",
    undefined,
    token
  );
}

// Consultar los profesionales de salud asignados al paciente que inició sesión
export async function obtenerMisProfesionales(
  token: string
): Promise<AsignacionResponse[]> {
  return await apiRequest<AsignacionResponse[]>(
    "/api/usuarios/me/personal-salud",
    "GET",
    undefined,
    token
  );
}

// Cambiar la contraseña del usuario que inició sesión
export async function cambiarMiContrasena(
  request: CambiarContrasenaRequest,
  token: string
): Promise<void> {
  await apiRequest<void>(
    "/api/usuarios/me/contrasena",
    "PATCH",
    request,
    token
  );
}

// Consultar un usuario por su ID
export async function obtenerUsuario(
  id: number,
  token: string
): Promise<UsuarioResponse> {
  return await apiRequest<UsuarioResponse>(
    `/api/usuarios/${id}`,
    "GET",
    undefined,
    token
  );
}

// Listar usuarios
export async function listarUsuarios(
  token: string
): Promise<UsuarioResponse[]> {
  return await apiRequest<UsuarioResponse[]>(
    "/api/usuarios",
    "GET",
    undefined,
    token
  );
}

// Desactivar un usuario por su ID
export async function desactivarUsuario(
  id: number,
  token: string
): Promise<void> {
  await apiRequest<void>(
    `/api/usuarios/${id}`,
    "DELETE",
    undefined,
    token
  );
}
