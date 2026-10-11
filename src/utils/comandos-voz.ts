/**
 * Interpretación de lo que la persona le dice al asistente "Oye VITA".
 *
 * Son funciones puras (no tocan la pantalla): reciben el texto reconocido y devuelven
 * qué hay que hacer. El asistente (asistente-context) es quien ejecuta el resultado.
 */

// ---------------------------------------------------------------------------------------------
// Tipos que cada pantalla le entrega al asistente
// ---------------------------------------------------------------------------------------------

export type TipoDato = 'texto' | 'nombre' | 'correo' | 'numero' | 'contrasena';

/** Un campo que se puede llenar por voz, por ejemplo "mi correo es …". */
export type CampoVoz = {
    /** Palabras con las que la persona nombra el campo, sin tildes y en minúscula: ["correo", "email"]. */
    claves: string[];
    etiqueta: string;
    tipo: TipoDato;
    valor: string;
    asignar: (valor: string) => void;
};

/** Una opción que se marca o desmarca, por ejemplo una discapacidad. */
export type OpcionVoz = {
    claves: string[];
    etiqueta: string;
    marcada: boolean;
    cambiar: (marcar: boolean) => void;
};

/** Una acción de la pantalla, por ejemplo "iniciar sesión" o "ir al registro". */
export type AccionVoz = {
    frases: string[];
    ejecutar: () => void;
};

export type PantallaVoz = {
    /** Lo que se lee con "leer pantalla" o "dónde estoy". */
    descripcion: string;
    /** Ejemplos de órdenes para esta pantalla, que se leen con "qué puedo decir". */
    ejemplos: string[];
    campos: CampoVoz[];
    opciones?: OpcionVoz[];
    acciones: AccionVoz[];
};

/** Lo que el asistente debe hacer con una orden. */
export type Resultado =
    | { tipo: 'ayuda' }
    | { tipo: 'leerPantalla' }
    | { tipo: 'leerFormulario' }
    | { tipo: 'contraste' }
    | { tipo: 'texto'; cambio: 'aumentar' | 'disminuir' }
    | { tipo: 'apagar' }
    | { tipo: 'callar' }
    | { tipo: 'campo'; campo: CampoVoz; valor: string }
    | { tipo: 'borrarCampo'; campo: CampoVoz }
    | { tipo: 'opcion'; opcion: OpcionVoz; marcar: boolean }
    | { tipo: 'accion'; accion: AccionVoz }
    | { tipo: 'noEntendido' };

// ---------------------------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------------------------

/**
 * Quita tildes carácter por carácter, conservando la longitud del texto
 * (así las posiciones encontradas en el texto normalizado sirven en el original).
 */
function quitarTildes(texto: string): string {
    return [...texto].map((c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0) || c).join('');
}

/** Minúsculas y sin tildes, para comparar sin importar cómo lo escribió el reconocedor. */
export function normalizar(texto: string): string {
    return quitarTildes(texto.toLowerCase());
}

/** Quita los signos de puntuación que el reconocedor agrega al principio o al final (por ejemplo el punto final). */
export function limpiarBordes(texto: string): string {
    return texto.replace(/^[\s.,;:!?¡¿"']+/, '').replace(/[\s.,;:!?¡¿"']+$/, '');
}

function contieneAlguna(texto: string, frases: string[]): boolean {
    return frases.some((frase) => new RegExp(`(^|\\s)${frase}($|\\s)`).test(texto));
}

// ---------------------------------------------------------------------------------------------
// Palabra de activación: "Oye VITA"
// ---------------------------------------------------------------------------------------------

/**
 * Variantes que suelen salir del reconocedor al decir "Oye VITA"
 * ("vida" y "bita" son confusiones comunes).
 */
const ACTIVACION = /(^|[\s,.¡!¿?])(oye|hola|ey|hey|oiga)[\s,]+(vita|vida|bita|veta|beta)(?=$|[\s,.!?])/;

/**
 * Busca "Oye VITA" en lo que se dijo.
 * Devuelve null si no está, o el resto de la frase (la orden) si está, que puede venir vacía.
 */
export function separarActivacion(texto: string): string | null {
    const encontrado = ACTIVACION.exec(normalizar(texto));
    if (!encontrado) return null;
    return limpiarBordes(texto.slice(encontrado.index + encontrado[0].length));
}

// ---------------------------------------------------------------------------------------------
// Ajuste de lo dictado según el tipo de campo
// ---------------------------------------------------------------------------------------------

const DIGITOS: Record<string, string> = {
    cero: '0', uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4',
    cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
};

function palabrasADigitos(texto: string): string {
    return texto
        .split(/\s+/)
        .map((palabra) => DIGITOS[normalizar(palabra)] ?? palabra)
        .join(' ');
}

/** Convierte lo dictado al formato del campo. Nunca deja un punto u otro signo al final. */
export function ajustarValor(texto: string, tipo: TipoDato): string {
    const limpio = limpiarBordes(texto.trim());
    switch (tipo) {
        case 'correo':
            // "isabela punto ospina arroba gmail punto com" → "isabela.ospina@gmail.com"
            return normalizar(limpio)
                .replace(/\s*arroba\s*/g, '@')
                .replace(/\s*guion bajo\s*/g, '_')
                .replace(/\s*guion\s*/g, '-')
                .replace(/\s*punto\s*/g, '.')
                .replace(/\s+/g, '')
                .replace(/\.+$/, '');
        case 'numero':
            // "tres cero cero 1 2 3" → "300123"
            return palabrasADigitos(limpio).replace(/\D/g, '');
        case 'contrasena':
            // "mariposa dos cero dos cuatro" → "mariposa2024" (sin espacios, números como dígitos)
            return palabrasADigitos(limpio).replace(/\s+/g, '');
        case 'nombre':
            // "maria gomez" → "Maria Gomez"
            return limpio.replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toUpperCase());
        default:
            return limpio.charAt(0).toUpperCase() + limpio.slice(1);
    }
}

// ---------------------------------------------------------------------------------------------
// Interpretación de la orden
// ---------------------------------------------------------------------------------------------

/** Palabras de relleno que pueden ir antes del nombre del campo: "mi correo es…", "escribe el correo…". */
const PREFIJO_CAMPO = '(?:(?:escribe|escribir|pon|poner|cambia|cambiar|el|la|mi|su|en)\\s+)*';
/** Palabras que pueden ir entre el nombre del campo y el valor: "correo es…", "correo: …". */
const UNION_CAMPO = '(?:\\s+(?:es|seria|sera|son))?[\\s:,]+';

export function interpretar(orden: string, pantalla: PantallaVoz | null): Resultado {
    const original = limpiarBordes(orden.trim());
    const texto = normalizar(original);

    // 1. Llenar o borrar un campo. Va primero para que el valor dictado (por ejemplo una
    //    contraseña que contenga "ayuda") no se confunda con una orden general.
    if (pantalla) {
        const camposPorClave = pantalla.campos
            .flatMap((campo) => campo.claves.map((clave) => ({ clave, campo })))
            // Las claves más largas primero, para que "nombre del contacto" gane sobre "nombre"
            .sort((a, b) => b.clave.length - a.clave.length);

        // "borra el correo"
        const borrar = /^(borra|borrar|limpia|limpiar)\s+(?:el\s+|la\s+|mi\s+)?(.+)$/.exec(texto);
        if (borrar) {
            const objetivo = camposPorClave.find(({ clave }) => borrar[2].startsWith(clave));
            if (objetivo) return { tipo: 'borrarCampo', campo: objetivo.campo };
        }

        // "mi correo es …", "contraseña …"
        for (const { clave, campo } of camposPorClave) {
            const patron = new RegExp(`^${PREFIJO_CAMPO}${clave}${UNION_CAMPO}(.+)$`);
            const encontrado = patron.exec(texto);
            if (encontrado) {
                // El valor se toma del texto original (con tildes y mayúsculas), en la misma posición
                const inicio = texto.length - encontrado[1].length;
                return { tipo: 'campo', campo, valor: ajustarValor(original.slice(inicio), campo.tipo) };
            }
        }
    }

    // 2. Órdenes que sirven en cualquier pantalla
    if (contieneAlguna(texto, ['ayuda', 'que puedo decir', 'que puedo hacer', 'comandos'])) {
        return { tipo: 'ayuda' };
    }
    if (contieneAlguna(texto, ['callate', 'silencio', 'detente', 'cancelar'])) {
        return { tipo: 'callar' };
    }
    if (/(desactiva|desactivar|apaga|apagar)\s+(el\s+)?(modo voz|asistente)/.test(texto)) {
        return { tipo: 'apagar' };
    }
    if (contieneAlguna(texto, ['leer pantalla', 'lee la pantalla', 'leer la pantalla', 'donde estoy', 'que hay en la pantalla'])) {
        return { tipo: 'leerPantalla' };
    }
    if (contieneAlguna(texto, ['leer formulario', 'lee el formulario', 'leer el formulario', 'que he escrito', 'que escribi', 'que falta', 'revisar formulario'])) {
        return { tipo: 'leerFormulario' };
    }
    if (/contraste/.test(texto)) {
        return { tipo: 'contraste' };
    }
    if (/(texto|letra)/.test(texto) && /(aumenta|aumentar|agranda|agrandar|mas grande|sube|subir)/.test(texto)) {
        return { tipo: 'texto', cambio: 'aumentar' };
    }
    if (/(texto|letra)/.test(texto) && /(disminu|reduc|achica|mas pequen|baja|bajar)/.test(texto)) {
        return { tipo: 'texto', cambio: 'disminuir' };
    }

    if (!pantalla) return { tipo: 'noEntendido' };

    // 3. Marcar o desmarcar opciones: "tengo discapacidad visual", "quita auditiva"
    for (const opcion of pantalla.opciones ?? []) {
        if (!contieneAlguna(texto, opcion.claves)) continue;
        const quitar = /(quita|quitar|desmarca|desmarcar|no tengo|elimina|eliminar)/.test(texto);
        return { tipo: 'opcion', opcion, marcar: !quitar };
    }

    // 4. Acciones de la pantalla: "iniciar sesión", "crear cuenta", "ir al registro"
    const accion = pantalla.acciones.find((a) => contieneAlguna(texto, a.frases));
    if (accion) return { tipo: 'accion', accion };

    return { tipo: 'noEntendido' };
}