import type { Rol } from "./Rol";

export interface PersonalRequest {
  cedula: string;
  nombre: string;
  correo: string;
  contrasena: string;
  telefono?: string;
  rol: Rol;
}
