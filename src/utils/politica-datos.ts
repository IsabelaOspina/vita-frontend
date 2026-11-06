/**
 * Política de tratamiento de datos personales de VITA (Ley 1581 de 2012 y Decreto 1377 de 2013).
 * La versión debe coincidir con VERSION_POLITICA_TRATAMIENTO del backend (UsuarioServiceImpl),
 * que guarda cuál versión aceptó cada persona al crear su cuenta.
 */

export const VERSION_POLITICA_DATOS = '1.0';
export const FECHA_POLITICA_DATOS = 'noviembre de 2026';
export const CORREO_CONTACTO_DATOS = 'adminvita23@gmail.com';

export type SeccionPolitica = { titulo: string; parrafos: string[] };

export const SECCIONES_POLITICA_DATOS: SeccionPolitica[] = [
    {
        titulo: '1. Quién es responsable de tus datos',
        parrafos: [
            'VITA es una aplicación de salud accesible desarrollada como proyecto académico del curso Ingeniería de Software III de la Universidad del Quindío (Armenia, Colombia). El equipo de VITA es responsable del tratamiento de los datos personales que registras en la aplicación.',
            `Para cualquier consulta o solicitud sobre tus datos puedes escribir a ${CORREO_CONTACTO_DATOS}.`,
        ],
    },
    {
        titulo: '2. Qué datos recogemos',
        parrafos: [
            'Datos de identificación y contacto: nombre completo, cédula, correo electrónico, teléfono, fecha de nacimiento y dirección, si los registras.',
            'Datos de acceso: tu contraseña, que se guarda cifrada. Nadie del equipo puede verla.',
            'Contacto de emergencia: nombre, celular y parentesco de la persona que elijas.',
            'Datos de salud y de discapacidad (datos sensibles): discapacidades que indiques, síntomas, medicamentos y sus tomas, actividades de tu agenda y recomendaciones de tu profesional de salud.',
            'Ubicación: solo cuando pides ayuda de emergencia y solo si das permiso al celular. También puedes escribirla tú mismo o no enviarla.',
            'Preferencias de accesibilidad, como el tamaño del texto, el alto contraste o el modo voz.',
        ],
    },
    {
        titulo: '3. Para qué usamos tus datos',
        parrafos: [
            'Crear y proteger tu cuenta, y permitirte iniciar sesión y recuperar tu contraseña.',
            'Recordarte tus medicamentos y actividades, registrar tus síntomas y mostrarte su evolución.',
            'Permitir que el profesional de salud que te atiende en VITA vea tu información y te deje recomendaciones.',
            'Avisar a tu contacto de emergencia cuando pides ayuda: le enviamos por mensaje de texto tu nombre, el tipo de emergencia y, si la compartes, tu ubicación con un enlace de Google Maps.',
            'Adaptar la aplicación a tus necesidades de accesibilidad.',
        ],
    },
    {
        titulo: '4. Datos sensibles',
        parrafos: [
            'Tus datos de salud y de discapacidad son datos sensibles. No estás obligado a entregarlos: puedes no registrarlos, aunque algunas funciones de VITA dependen de ellos.',
            'Estos datos solo los ven tú y los profesionales de salud que te atienden en VITA. No los vendemos ni los usamos con fines comerciales.',
        ],
    },
    {
        titulo: '5. Con quién compartimos tus datos',
        parrafos: [
            'Con tu contacto de emergencia, solo cuando pides ayuda.',
            'Con los proveedores que hacen funcionar VITA, únicamente para prestar el servicio: Google Cloud (donde funciona el servidor), el servicio de correo con el que enviamos los códigos para recuperar la contraseña, e Inalambria (el servicio que envía los mensajes de texto de emergencia).',
            'Con autoridades, solo si una ley u orden judicial lo exige.',
        ],
    },
    {
        titulo: '6. Tus derechos',
        parrafos: [
            'Conocer, actualizar y corregir tus datos.',
            'Pedir prueba de la autorización que nos diste.',
            'Saber cómo hemos usado tus datos.',
            'Revocar esta autorización o pedir que eliminemos tus datos, cuando no exista un deber legal de conservarlos.',
            'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).',
            'Consultar tus datos de forma gratuita.',
        ],
    },
    {
        titulo: '7. Cómo ejercer tus derechos',
        parrafos: [
            `Escribe a ${CORREO_CONTACTO_DATOS} indicando tu nombre, tu cédula y lo que solicitas. Puedes actualizar varios de tus datos directamente en "Mi cuenta".`,
            'Respondemos las consultas en un máximo de 10 días hábiles y los reclamos en un máximo de 15 días hábiles, como lo establece la ley.',
        ],
    },
    {
        titulo: '8. Seguridad',
        parrafos: [
            'Las contraseñas se guardan cifradas, la comunicación con el servidor es segura y, después de varios intentos fallidos, el inicio de sesión se bloquea por un tiempo para proteger tu cuenta.',
        ],
    },
    {
        titulo: '9. Vigencia',
        parrafos: [
            `Versión ${VERSION_POLITICA_DATOS}, vigente desde ${FECHA_POLITICA_DATOS}. Tus datos se conservan mientras tengas una cuenta en VITA. Si cambiamos esta política, te lo informaremos en la aplicación.`,
        ],
    },
];

/** Todo el texto, para leerlo en voz alta. */
export function textoCompletoPolitica(): string {
    return SECCIONES_POLITICA_DATOS.map((s) => `${s.titulo}. ${s.parrafos.join(' ')}`).join(' ');
}

// ----- Aceptar desde la pantalla de la política ------------------------------------------------

let aceptadaDesdeLaPolitica = false;

/** La persona tocó "Acepto la política" en la pantalla de la política (el registro lo marca al volver). */
export function aceptarDesdeLaPolitica() {
    aceptadaDesdeLaPolitica = true;
}

/** Devuelve true una sola vez si se aceptó desde la pantalla de la política. */
export function tomarAceptacionDeLaPolitica(): boolean {
    const aceptada = aceptadaDesdeLaPolitica;
    aceptadaDesdeLaPolitica = false;
    return aceptada;
}