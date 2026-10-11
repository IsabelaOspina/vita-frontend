
import type { ContactoEmergenciaRequest } from "./ContactoEmergenciaRequest";
import type { DiscapacidadRequest } from "./DiscapacidadRequest";
import type { ConfiguracionAccesibilidadRequest } from "./ConfiguracionAccesibilidadRequest";

export interface UsuarioRequest {
  cedula: string;
  nombre: string;
  correo: string;
  contrasena: string;
  telefono?: string;
  fechaNacimiento?: string;
  direccion?: string;
  contactoEmergencia?: ContactoEmergenciaRequest;
  discapacidades?: DiscapacidadRequest[];
  configuracionAccesibilidad?: ConfiguracionAccesibilidadRequest;
}
