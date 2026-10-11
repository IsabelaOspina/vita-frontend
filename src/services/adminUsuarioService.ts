
import { apiRequest } from "./api";
import type { PersonalRequest } from "../dto/PersonalRequest";
import type { UsuarioResponse } from "../dto/UsuarioResponse";

export async function crearPersonal(
  personal: PersonalRequest,
  token: string
): Promise<UsuarioResponse> {
  return apiRequest<UsuarioResponse>(
    "/api/admin/usuarios",
    "POST",
    personal,
    token
  );
}
