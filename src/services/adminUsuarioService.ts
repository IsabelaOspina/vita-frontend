import { apiRequest } from "./api";

import type { PersonalRequest } from "../dto/PersonalRequest";
import type { UsuarioResponse } from "../dto/UsuarioResponse";
import type { Rol } from "../dto/Rol";

// Registrar un profesional de la salud
export async function crearPersonal(
  personal: PersonalRequest,
  token: string
): Promise<UsuarioResponse> {
  return await apiRequest<UsuarioResponse>(
    "/api/admin/usuarios",
    "POST",
    personal,
    token
  );
}

// Listar todas las cuentas o filtrarlas por rol
export async function listarUsuariosAdmin(
  token: string,
  rol?: Rol
): Promise<UsuarioResponse[]> {
  let endpoint = "/api/admin/usuarios";

  if (rol) {
    endpoint = `/api/admin/usuarios?rol=${encodeURIComponent(rol)}`;
  }

  return await apiRequest<UsuarioResponse[]>(
    endpoint,
    "GET",
    undefined,
    token
  );
}

// Reactivar una cuenta desactivada
export async function reactivarUsuario(
  id: number,
  token: string
): Promise<UsuarioResponse> {
  return await apiRequest<UsuarioResponse>(
    `/api/admin/usuarios/${id}/reactivar`,
    "PATCH",
    undefined,
    token
  );
}

