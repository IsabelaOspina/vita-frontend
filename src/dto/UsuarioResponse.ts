
import type { Rol } from "./Rol";
import type { ContactoEmergenciaResponse } from "./ContactoEmergenciaResponse";
import type { DiscapacidadResponse } from "./DiscapacidadResponse";
import type { ConfiguracionAccesibilidadResponse } from "./ConfiguracionAccesibilidadResponse";

export interface UsuarioResponse {
  id: number;
  cedula: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  activo: boolean;
  rol: Rol;
  contactoEmergencia: ContactoEmergenciaResponse | null;
  discapacidades: DiscapacidadResponse[];
  configuracionAccesibilidad: ConfiguracionAccesibilidadResponse | null;
}
