import { requireOptionalNativeModule } from 'expo';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type ModuloReconocimiento = typeof import('expo-speech-recognition');

/**
 * Carga expo-speech-recognition solo si está disponible.
 *
 * Expo Go no trae este módulo nativo, y la librería lanza un error apenas se importa.
 * Por eso no se importa arriba del archivo: así la app sigue abriendo en Expo Go
 * (simplemente sin dictado) y el dictado funciona en un development build, en el APK
 * y en la versión web (Chrome, Edge y Safari usan el reconocimiento de voz del navegador).
 */
function cargarReconocimiento(): ModuloReconocimiento | null {
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-speech-recognition') as ModuloReconocimiento;
  } catch {
    return null;
  }
}

const reconocimiento = cargarReconocimiento();

function hayReconocimiento(): boolean {
  try {
    return !!reconocimiento?.ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/** Idioma del reconocimiento: español de Colombia. */
const IDIOMA_DICTADO = 'es-CO';

/** Solo un campo puede estar escuchando a la vez; este id dice cuál. */
let campoEscuchando: number | null = null;
let siguienteId = 1;

const MENSAJES_ERROR: Partial<Record<string, string>> = {
  'not-allowed': 'Necesitamos permiso para usar el micrófono. Actívalo en los ajustes del celular.',
  'service-not-allowed': 'El reconocimiento de voz no está permitido en este dispositivo.',
  'no-speech': 'No te escuché. Toca el micrófono e intenta de nuevo.',
  'speech-timeout': 'No te escuché. Toca el micrófono e intenta de nuevo.',
  'audio-capture': 'No pudimos usar el micrófono. Revisa que no lo esté usando otra aplicación.',
  network: 'El dictado necesita conexión a internet.',
  'language-not-supported': 'Tu dispositivo no tiene disponible el reconocimiento de voz en español.',
  busy: 'El micrófono está ocupado. Intenta de nuevo en un momento.',
};

type Opciones = {
  /** Recibe lo que se va reconociendo (también los resultados parciales, mientras la persona habla). */
  alReconocer: (texto: string, esFinal: boolean) => void;
  /** Recibe un mensaje de error ya listo para mostrar al usuario. */
  alFallar: (mensaje: string) => void;
};

/**
 * Dictado por voz para un campo de texto.
 * `disponible` es false en Expo Go o en navegadores sin reconocimiento de voz (por ejemplo Firefox).
 */
export function useDictado({ alReconocer, alFallar }: Opciones) {
  const [escuchando, setEscuchando] = useState(false);
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = siguienteId++;

  // Referencias a las funciones más recientes, para no volver a registrar los eventos en cada render
  const alReconocerRef = useRef(alReconocer);
  const alFallarRef = useRef(alFallar);
  alReconocerRef.current = alReconocer;
  alFallarRef.current = alFallar;

  // Se detecta al abrir la pantalla (no durante el render) para que la versión web generada
  // de antemano coincida con lo que muestra el navegador
  const [disponible, setDisponible] = useState(false);

  useEffect(() => {
    setDisponible(hayReconocimiento());
    if (!reconocimiento) return;
    const modulo = reconocimiento.ExpoSpeechRecognitionModule;
    const esMio = () => campoEscuchando === idRef.current;

    const suscripciones = [
      modulo.addListener('result', (evento) => {
        if (!esMio()) return;
        const texto = evento.results[0]?.transcript ?? '';
        if (texto) alReconocerRef.current(texto, evento.isFinal);
      }),
      modulo.addListener('error', (evento) => {
        if (!esMio()) return;
        // "aborted" ocurre cuando la misma app detiene el dictado: no es un error para el usuario
        if (evento.error !== 'aborted') {
          alFallarRef.current(MENSAJES_ERROR[evento.error] ?? 'No pudimos reconocer tu voz. Intenta de nuevo.');
        }
      }),
      modulo.addListener('end', () => {
        if (!esMio()) return;
        campoEscuchando = null;
        setEscuchando(false);
      }),
    ];

    return () => {
      suscripciones.forEach((s) => s.remove());
      if (esMio()) {
        modulo.abort();
        campoEscuchando = null;
      }
    };
  }, []);

  const iniciar = async () => {
    if (!reconocimiento || !disponible) return;
    const modulo = reconocimiento.ExpoSpeechRecognitionModule;

    const permiso = await modulo.requestPermissionsAsync();
    if (!permiso.granted) {
      alFallarRef.current(MENSAJES_ERROR['not-allowed']!);
      return;
    }

    // Si la app está hablando (modo voz), se calla para que el micrófono no se escuche a sí misma
    Speech.stop();
    // Si otro campo estaba escuchando, se detiene: solo se dicta en un campo a la vez
    if (campoEscuchando !== null) modulo.abort();

    campoEscuchando = idRef.current;
    setEscuchando(true);
    modulo.start({ lang: IDIOMA_DICTADO, interimResults: true, continuous: false });
  };

  const detener = () => {
    if (!reconocimiento || campoEscuchando !== idRef.current) return;
    reconocimiento.ExpoSpeechRecognitionModule.stop();
  };

  return { disponible, escuchando, iniciar, detener };
}

// ---------------------------------------------------------------------------------------------
// Ajuste del texto dictado según el tipo de campo
// ---------------------------------------------------------------------------------------------

export type TipoDictado = 'texto' | 'nombre' | 'correo' | 'numero';

const DIGITOS: Record<string, string> = {
  cero: '0', uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4',
  cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
};

function sinTildes(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Convierte lo que se dictó al formato que espera el campo. */
export function ajustarDictado(texto: string, tipo: TipoDictado): string {
  switch (tipo) {
    case 'correo':
      // "isabela punto ospina arroba gmail punto com" → "isabela.ospina@gmail.com"
      return sinTildes(texto.toLowerCase())
        .replace(/\s*arroba\s*/g, '@')
        .replace(/\s*guion bajo\s*/g, '_')
        .replace(/\s*guion\s*/g, '-')
        .replace(/\s*punto\s*/g, '.')
        .replace(/\s+/g, '');
    case 'numero':
      // "tres cero cero 1 2 3" → "300123"
      return texto
        .toLowerCase()
        .split(/\s+/)
        .map((palabra) => DIGITOS[sinTildes(palabra)] ?? palabra)
        .join('')
        .replace(/\D/g, '');
    case 'nombre':
      // "maria gomez" → "Maria Gomez"
      return texto.replace(/(^|\s)(\p{L})/gu, (_, espacio, letra) => espacio + letra.toUpperCase());
    default:
      return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
}