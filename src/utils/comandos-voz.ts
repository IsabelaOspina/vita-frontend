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
    /** Los campos opcionales no se mencionan cuando el asistente dice qué falta. */
    opcional?: boolean;
    /** Cómo pregunta el asistente por este campo, por ejemplo "¿Cuál es tu correo?". */
    pregunta?: string;
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
    /** Cómo la nombra el asistente al ofrecerla ("¿Quieres crear la cuenta?"). */
    etiqueta?: string;
    ejecutar: () => void;
};

export type PantallaVoz = {
    /** Nombre corto de la pantalla, por ejemplo "Crear cuenta". */
    titulo?: string;
    /** Lo que se lee con "leer pantalla" o "dónde estoy". */
    descripcion: string;
    /** Ejemplos de órdenes para esta pantalla, que se leen con "ayuda". */
    ejemplos: string[];
    campos: CampoVoz[];
    opciones?: OpcionVoz[];
    /** La primera acción es la principal (la que se sugiere cuando el formulario está completo). */
    acciones: AccionVoz[];
    /**
     * Preguntas que el asistente hace al terminar los campos obligatorios, antes de ofrecer la
     * acción principal. Por ejemplo: "¿Quieres agregar un contacto de emergencia?".
     */
    pasosOpcionales?: PasoOpcional[];
};

export type PasoOpcional = {
    /** Pregunta de sí o no. */
    pregunta: string;
    /** Si dice que sí, se piden estos campos (por su etiqueta), uno por uno. */
    campos?: string[];
    /** Si dice que sí y el paso es de opciones, esto es lo que se pregunta ("¿Cuál?"). */
    siAcepta?: string;
    /** El paso es elegir entre las opciones de la pantalla. */
    opciones?: boolean;
};

/** Lo que el asistente debe hacer con una orden. */
export type Resultado =
    | { tipo: 'ayuda' }
    | { tipo: 'masAyuda' }
    | { tipo: 'leerPantalla' }
    | { tipo: 'leerFormulario' }
    | { tipo: 'contraste' }
    | { tipo: 'texto'; cambio: 'aumentar' | 'disminuir' }
    | { tipo: 'velocidad'; cambio: 'mas' | 'menos' }
    | { tipo: 'repetir' }
    | { tipo: 'apagar' }
    | { tipo: 'callar' }
    | { tipo: 'campo'; campo: CampoVoz; valor: string }
    | { tipo: 'borrarCampo'; campo: CampoVoz }
    | { tipo: 'deletrear'; campo: CampoVoz }
    /** Nombró un campo sin decir el valor ("la contraseña es…"): el asistente lo pregunta. */
    | { tipo: 'pedirCampo'; campo: CampoVoz }
    | { tipo: 'opcion'; opcion: OpcionVoz; marcar: boolean }
    | { tipo: 'accion'; accion: AccionVoz; indice: number }
    | { tipo: 'noEntendido'; texto: string };

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

/** Normaliza y además cambia la puntuación interna por espacios: "inicia sesión, por favor." → "inicia sesion por favor". */
export function aPalabras(texto: string): string {
    return normalizar(texto).replace(/[.,;:!?¡¿"']/g, ' ').replace(/\s+/g, ' ').trim();
}

function contieneAlguna(texto: string, frases: string[]): boolean {
    return frases.some((frase) => new RegExp(`(^|\\s)${frase}($|\\s)`).test(texto));
}

/** Cuántas letras hay que cambiar para pasar de una palabra a otra (distancia de Levenshtein). */
function distancia(a: string, b: string): number {
    if (a === b) return 0;
    const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let anterior = fila[0];
        fila[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const temporal = fila[j];
            fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
            anterior = temporal;
        }
    }
    return fila[b.length];
}

/** Dos palabras "se parecen" si el reconocedor pudo haber confundido una letra (dos en palabras largas). */
function seParecen(dicha: string | undefined, esperada: string): boolean {
    if (dicha === undefined) return false;
    if (dicha === esperada) return true;
    if (esperada.length < 5) return false;
    return distancia(dicha, esperada) <= (esperada.length >= 8 ? 2 : 1);
}

/** ¿Están todas las palabras de la frase, en orden y parecidas, dentro de lo dicho? */
function contieneParecida(palabras: string[], frase: string): boolean {
    let desde = 0;
    for (const buscada of frase.split(' ')) {
        const encontrada = palabras.slice(desde).findIndex((p) => seParecen(p, buscada));
        if (encontrada < 0) return false;
        desde += encontrada + 1;
    }
    return true;
}

// ---------------------------------------------------------------------------------------------
// Palabra de activación: "Oye VITA"
// ---------------------------------------------------------------------------------------------

/** Lo que el reconocedor suele escribir al oír "VITA". */
const NOMBRE = '(?:vita|vida|bita|bida|veta|beta|vitta|pita|evita|vito|bito)';
/** Lo que suele escribir al oír "oye" (o un saludo parecido). */
const SALUDO = '(?:oye|oie|olle|oi|oiga|hoy|hola|ey|hey|ei|o|y)';

/** "Oye VITA" en cualquier parte de la frase ("eh… oye vita, …"). */
const ACTIVACION_CON_SALUDO = new RegExp(`(^|[\\s,.¡!¿?])${SALUDO}[\\s,]*${NOMBRE}(?=$|[\\s,.!?])`);
/** "oyevita" pegado. */
const ACTIVACION_PEGADA = new RegExp(`(^|\\s)oye${NOMBRE}(?=$|[\\s,.!?])`);
/** Solo "VITA" también sirve, pero únicamente al empezar la frase ("Vita, inicia sesión"). */
const ACTIVACION_SOLO_NOMBRE = new RegExp(`^[\\s¡¿]*${NOMBRE}(?=$|[\\s,.!?])`);

/**
 * Busca "Oye VITA" en lo que se dijo.
 * Devuelve null si no está, o el resto de la frase (la orden) si está, que puede venir vacía.
 */
export function separarActivacion(texto: string): string | null {
    const normal = normalizar(texto);
    const encontrado =
        ACTIVACION_CON_SALUDO.exec(normal) ?? ACTIVACION_PEGADA.exec(normal) ?? ACTIVACION_SOLO_NOMBRE.exec(normal);
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

/** Símbolos que se pueden dictar en una contraseña o un correo (con o sin tilde). */
const SIMBOLOS: [RegExp, string][] = [
    [/\s*(?<!\p{L})(?:gui[oó]n bajo|gui[oó]n de piso|subrayado)(?!\p{L})\s*/giu, '_'],
    [/\s*(?<!\p{L})(?:arroba|a roba)(?!\p{L})\s*/giu, '@'],
    [/\s*(?<!\p{L})(?:numeral|almohadilla)(?!\p{L})\s*/giu, '#'],
    [/\s*(?<!\p{L})asterisco(?!\p{L})\s*/giu, '*'],
    [/\s*(?<!\p{L})(?:signo de )?(?:exclamaci[oó]n|admiraci[oó]n)(?!\p{L})\s*/giu, '!'],
    [/\s*(?<!\p{L})(?:signo de )?(?:pesos|d[oó]lar)(?!\p{L})\s*/giu, '$'],
    [/\s*(?<!\p{L})(?:gui[oó]n|raya)(?!\p{L})\s*/giu, '-'],
    [/\s*(?<!\p{L})punto(?!\p{L})\s*/giu, '.'],
];

function reemplazarSimbolos(texto: string): string {
    return SIMBOLOS.reduce((resultado, [patron, simbolo]) => resultado.replace(patron, simbolo), texto);
}

/** Convierte lo dictado al formato del campo. Nunca deja un punto u otro signo al final. */
export function ajustarValor(texto: string, tipo: TipoDato): string {
    const limpio = limpiarBordes(texto.trim());
    switch (tipo) {
        case 'correo': {
            // "isabela punto ospina cinco arroba gmail punto com" → "isabela.ospina5@gmail.com"
            const correo = palabrasADigitos(normalizar(limpio))
                .replace(/\bg mail\b/g, 'gmail')
                .replace(/\bhot mail\b/g, 'hotmail')
                .replace(/\bout look\b/g, 'outlook');
            return reemplazarSimbolos(correo).replace(/\s+/g, '').replace(/[.@]+$/, '');
        }
        case 'numero':
            // "tres cero cero 1 2 3" → "300123"
            return palabrasADigitos(limpio).replace(/\D/g, '');
        case 'contrasena': {
            // "mariposa dos cero dos cuatro" → "mariposa2024"
            // "mayúscula m ariposa numeral" → "Mariposa#"
            const conMayusculas = palabrasADigitos(limpio).replace(
                /(?<!\p{L})may[uú]scula\s+(\p{L})/giu,
                (_, letra: string) => letra.toUpperCase(),
            );
            return reemplazarSimbolos(conMayusculas).replace(/\s+/g, '');
        }
        case 'nombre':
            // "maria de los angeles gomez" → "Maria de los Angeles Gomez"
            return limpio
                .split(/\s+/)
                .map((palabra, i) =>
                    i > 0 && /^(y|e|de|del|la|las|los)$/i.test(palabra)
                        ? palabra.toLowerCase()
                        : palabra.charAt(0).toUpperCase() + palabra.slice(1),
                )
                .join(' ');
        default:
            return limpio.charAt(0).toUpperCase() + limpio.slice(1);
    }
}

/** Cómo se lee cada carácter al deletrear ("M mayúscula, a, r, i…"). */
export function deletrear(valor: string): string {
    const NOMBRES: Record<string, string> = {
        '@': 'arroba', '.': 'punto', '_': 'guion bajo', '-': 'guion', '#': 'numeral',
        '*': 'asterisco', '!': 'signo de exclamación', '$': 'signo de pesos', ' ': 'espacio',
    };
    return [...valor]
        .map((c) => {
            if (NOMBRES[c]) return NOMBRES[c];
            if (/\p{Lu}/u.test(c)) return `${c} mayúscula`;
            return c;
        })
        .join(', ');
}

// ---------------------------------------------------------------------------------------------
// Interpretación de una orden
// ---------------------------------------------------------------------------------------------

/** Palabras de relleno que pueden ir antes del nombre del campo: "mi correo es…", "escribe el correo…". */
const PREFIJO_CAMPO =
    '(?:(?:escribe|escribir|pon|poner|cambia|cambiar|quiero|agregar|agrega|anadir|anade|llenar|llena|el|la|mi|su|en|que|numero de|cual es)\\s+)*';
/** Palabras que pueden ir entre el nombre del campo y el valor: "correo es…", "correo: …". */
const UNION_CAMPO = '(?:\\s+(?:es|seria|sera|son|va a ser))?[\\s:,]+';
const PALABRAS_RELLENO = new Set(['escribe', 'escribir', 'pon', 'poner', 'cambia', 'cambiar', 'el', 'la', 'mi', 'su', 'en']);
/** Palabras que pueden acompañar al nombre de un campo cuando todavía no se dice el valor. */
const RELLENO_PEDIR = new Set([
    'quiero', 'agregar', 'agrega', 'anadir', 'anade', 'poner', 'pon', 'llenar', 'llena', 'escribir', 'escribe',
    'cambiar', 'cambia', 'el', 'la', 'mi', 'un', 'una', 'su', 'de', 'del', 'es', 'seria', 'sera', 'numero', 'ahora', 'ya', 'voy', 'a', 'dar', 'decir', 'te',
]);
const QUITAR = /(quita|quitar|desmarca|desmarcar|no tengo|elimina|eliminar)/;

function camposOrdenados(pantalla: PantallaVoz) {
    return (
        pantalla.campos
            .flatMap((campo) => campo.claves.map((clave) => ({ clave, campo })))
            // Las claves más largas primero, para que "nombre del contacto" gane sobre "nombre"
            .sort((a, b) => b.clave.length - a.clave.length)
    );
}

/** Intenta reconocer la orden aunque el reconocedor haya cambiado alguna letra ("contraseya" por "contraseña"). */
function interpretarParecido(original: string, pantalla: PantallaVoz): Resultado | null {
    const palabras = aPalabras(original).split(' ');

    // Campo: "mi contraseya es …"
    let inicio = 0;
    while (inicio < palabras.length && PALABRAS_RELLENO.has(palabras[inicio])) inicio++;
    for (const { clave, campo } of camposOrdenados(pantalla)) {
        const partes = clave.split(' ');
        if (!partes.every((p, i) => seParecen(palabras[inicio + i], p))) continue;
        let resto = inicio + partes.length;
        if (['es', 'seria', 'sera', 'son'].includes(palabras[resto])) resto++;
        if (resto >= palabras.length) continue;
        // Se toman las mismas palabras del texto original (con mayúsculas y tildes)
        const valor = ajustarValor(limpiarBordes(original).split(/\s+/).slice(resto).join(' '), campo.tipo);
        if (valor) return { tipo: 'campo', campo, valor };
    }

    // Acción: "inicia secion"
    const indice = pantalla.acciones.findIndex((a) => a.frases.some((f) => contieneParecida(palabras, f)));
    if (indice >= 0) return { tipo: 'accion', accion: pantalla.acciones[indice], indice };

    // Opción: "discapacidad cognitba"
    for (const opcion of pantalla.opciones ?? []) {
        if (opcion.claves.some((c) => contieneParecida(palabras, c))) {
            return { tipo: 'opcion', opcion, marcar: !QUITAR.test(palabras.join(' ')) };
        }
    }
    return null;
}

export function interpretar(orden: string, pantalla: PantallaVoz | null): Resultado {
    const original = limpiarBordes(orden.trim());
    const texto = normalizar(original);
    const palabras = aPalabras(original);

    if (!palabras) return { tipo: 'noEntendido', texto: original };

    // 1. Llenar, borrar o deletrear un campo. Va primero para que el valor dictado (por ejemplo una
    //    contraseña que contenga "ayuda") no se confunda con una orden general.
    if (pantalla) {
        const porClave = camposOrdenados(pantalla);

        // "borra el correo"
        const borrar = /^(?:borra|borrar|limpia|limpiar)\s+(?:el\s+|la\s+|mi\s+)?(.+)$/.exec(palabras);
        if (borrar) {
            const objetivo = porClave.find(({ clave }) => borrar[1].startsWith(clave));
            if (objetivo) return { tipo: 'borrarCampo', campo: objetivo.campo };
        }

        // "deletrea la contraseña", "cómo quedó el correo"
        const leerCampo = /^(?:deletrea|deletrear|lee|leer|repite|repetir|como quedo|como escribiste)\s+(?:el\s+|la\s+|mi\s+)?(.+)$/.exec(palabras);
        if (leerCampo) {
            const objetivo = porClave.find(({ clave }) => leerCampo[1].startsWith(clave));
            if (objetivo) return { tipo: 'deletrear', campo: objetivo.campo };
        }

        // Nombró un campo pero aún no dijo el valor: "la contraseña es…", "quiero agregar contacto de emergencia"
        for (const { clave, campo } of camposOrdenados(pantalla)) {
            const encontrado = new RegExp(`(^|\\s)${clave}($|\\s)`).exec(palabras);
            if (!encontrado) continue;
            const resto = (palabras.slice(0, encontrado.index) + ' ' + palabras.slice(encontrado.index + encontrado[0].length))
                .split(' ')
                .filter(Boolean);
            if (resto.every((p) => RELLENO_PEDIR.has(p))) return { tipo: 'pedirCampo', campo };
            break;
        }

        // "mi correo es …", "contraseña …"
        for (const { clave, campo } of porClave) {
            const patron = new RegExp(`^${PREFIJO_CAMPO}${clave}${UNION_CAMPO}(.+)$`);
            const encontrado = patron.exec(texto);
            if (encontrado) {
                // El valor se toma del texto original (con tildes y mayúsculas), en la misma posición
                const inicio = texto.length - encontrado[1].length;
                const valor = ajustarValor(original.slice(inicio), campo.tipo);
                if (valor && !aPalabras(valor).split(' ').every((p) => RELLENO_PEDIR.has(p))) {
                    return { tipo: 'campo', campo, valor };
                }
            }
        }
    }

    // 2. Órdenes que sirven en cualquier pantalla
    if (contieneAlguna(palabras, ['mas ayuda', 'mas opciones', 'otras opciones', 'todas las opciones', 'que mas puedo decir', 'comandos'])) {
        return { tipo: 'masAyuda' };
    }
    if (contieneAlguna(palabras, ['ayuda', 'ayudame', 'que puedo decir', 'que puedo hacer', 'que hago', 'guiame'])) {
        return { tipo: 'ayuda' };
    }
    if (contieneAlguna(palabras, ['callate', 'silencio', 'detente', 'cancelar', 'basta'])) {
        return { tipo: 'callar' };
    }
    if (/(desactiva|desactivar|apaga|apagar|quita|quitar)\s+(el\s+)?(modo voz|modo de voz|asistente)/.test(palabras)) {
        return { tipo: 'apagar' };
    }
    if (contieneAlguna(palabras, ['repite', 'repetir', 'otra vez', 'que dijiste', 'no te escuche', 'no te entendi'])) {
        return { tipo: 'repetir' };
    }
    if (/(habla|hablar|lee|leer|voz)/.test(palabras) && /(rapido|rapida|acelera)/.test(palabras)) {
        return { tipo: 'velocidad', cambio: 'mas' };
    }
    if (/(habla|hablar|lee|leer|voz)/.test(palabras) && /(despacio|lento|lenta)/.test(palabras)) {
        return { tipo: 'velocidad', cambio: 'menos' };
    }
    if (contieneAlguna(palabras, ['leer pantalla', 'lee la pantalla', 'leer la pantalla', 'donde estoy', 'que hay en la pantalla', 'en que pantalla estoy'])) {
        return { tipo: 'leerPantalla' };
    }
    if (contieneAlguna(palabras, ['leer formulario', 'lee el formulario', 'leer el formulario', 'que he escrito', 'que escribi', 'que falta', 'revisar formulario', 'revisa el formulario', 'como voy'])) {
        return { tipo: 'leerFormulario' };
    }
    if (/contraste/.test(palabras)) {
        return { tipo: 'contraste' };
    }
    if (/(texto|letra)/.test(palabras) && /(aumenta|aumentar|agranda|agrandar|mas grande|sube|subir)/.test(palabras)) {
        return { tipo: 'texto', cambio: 'aumentar' };
    }
    if (/(texto|letra)/.test(palabras) && /(disminu|reduc|achica|mas pequen|baja|bajar)/.test(palabras)) {
        return { tipo: 'texto', cambio: 'disminuir' };
    }

    if (!pantalla) return { tipo: 'noEntendido', texto: original };

    // 3. Marcar o desmarcar opciones: "tengo discapacidad visual", "quita auditiva"
    for (const opcion of pantalla.opciones ?? []) {
        if (!contieneAlguna(palabras, opcion.claves)) continue;
        return { tipo: 'opcion', opcion, marcar: !QUITAR.test(palabras) };
    }

    // 4. Acciones de la pantalla: "iniciar sesión", "crear cuenta", "ir al registro"
    const indice = pantalla.acciones.findIndex((a) => contieneAlguna(palabras, a.frases));
    if (indice >= 0) return { tipo: 'accion', accion: pantalla.acciones[indice], indice };

    // 5. Último intento, tolerando letras mal reconocidas
    return interpretarParecido(original, pantalla) ?? { tipo: 'noEntendido', texto: original };
}

// ---------------------------------------------------------------------------------------------
// Varias órdenes en una sola frase
// ---------------------------------------------------------------------------------------------

/** Palabras que unen dos órdenes: "mi correo es … y mi contraseña es … y luego inicia sesión". */
const CONECTORES = new Set(['y', 'e', 'luego', 'despues', 'tambien', 'entonces', 'ademas', 'finalmente']);
const VERBO_OPCION = /(tengo|marca|marcar|selecciona|seleccionar|agrega|agregar|quita|quitar|desmarca|desmarcar|elimina|eliminar)/;

/**
 * Parte una frase con varias órdenes y las interpreta una por una.
 *
 * Solo se corta en un conector ("y", "luego", "después"…) cuando lo que sigue es una orden
 * por sí sola. Así "mi nombre es María y José" no se parte (José no es una orden), pero
 * "mi correo es … y mi contraseña es …" sí.
 */
export function interpretarVarias(orden: string, pantalla: PantallaVoz | null): Resultado[] {
    const palabras = limpiarBordes(orden.trim()).split(/\s+/).filter(Boolean);

    // Trozos separados en cada conector, recordando qué conector había para poder volver a unirlos
    const trozos: { conector: string; palabras: string[] }[] = [{ conector: '', palabras: [] }];
    for (const palabra of palabras) {
        const actual = trozos[trozos.length - 1];
        if (CONECTORES.has(aPalabras(palabra))) {
            if (actual.palabras.length) trozos.push({ conector: palabra, palabras: [] });
            else actual.conector = `${actual.conector} ${palabra}`.trim();
        } else {
            actual.palabras.push(palabra);
        }
    }

    const segmentos: string[] = [];
    for (const trozo of trozos) {
        if (!trozo.palabras.length) continue;
        const texto = trozo.palabras.join(' ');
        if (!segmentos.length || interpretar(texto, pantalla).tipo !== 'noEntendido') segmentos.push(texto);
        else segmentos[segmentos.length - 1] += ` ${trozo.conector} ${texto}`;
    }
    if (!segmentos.length) return [{ tipo: 'noEntendido', texto: orden }];

    const resultados = segmentos.map((s) => interpretar(s, pantalla));

    // "quita visual y auditiva": la segunda opción hereda el "quitar" de la primera
    for (let i = 1; i < resultados.length; i++) {
        const actual = resultados[i];
        const anterior = resultados[i - 1];
        if (actual.tipo === 'opcion' && anterior.tipo === 'opcion' && !VERBO_OPCION.test(aPalabras(segmentos[i]))) {
            resultados[i] = { ...actual, marcar: anterior.marcar };
        }
    }
    return resultados;
}