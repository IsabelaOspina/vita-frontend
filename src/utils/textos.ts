import type { Rol } from '@/dto/Rol';
import type { TipoDiscapacidad } from '@/dto/TipoDiscapacidad';

/** Cómo se muestra cada rol. */
export function nombreRol(rol: Rol): string {
    switch (rol) {
        case 'ADMIN':
            return 'Administrador';
        case 'PERSONAL_SALUD':
            return 'Personal de salud';
        default:
            return 'Paciente';
    }
}

const DISCAPACIDADES: Record<TipoDiscapacidad, string> = {
    VISUAL: 'Visual',
    AUDITIVA: 'Auditiva',
    COGNITIVA: 'Cognitiva',
    DEL_HABLA: 'Del habla',
};

export function nombreDiscapacidad(tipo: TipoDiscapacidad): string {
    return DISCAPACIDADES[tipo] ?? tipo;
}

export function fechaLarga(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function primerNombre(nombre: string): string {
    return nombre.trim().split(/\s+/)[0] ?? nombre;
}