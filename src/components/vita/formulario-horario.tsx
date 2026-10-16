import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { MedicamentoResponse } from '@/dto/MedicamentoResponse';
import { TipoFrecuenciaMedicamento } from '@/dto/TipoFrecuenciaMedicamento';
import type { TipoRecordatorio } from '@/dto/TipoRecordatorio';
import { crearHorario } from '@/services/horarioMedicamenteService';
import { obtenerMedicamento } from '@/services/medicamentoService';
import { aPalabras, type CampoVoz, type Resultado } from '@/utils/comandos-voz';
import { aDia, aFechaHoraLocal, deFechaLocal, horaCorta } from '@/utils/fechas';
import { dejarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import {
    aHoraBackend,
    DIAS_SEMANA,
    diaLargo,
    enumerar,
    FRECUENCIAS,
    interpretarFecha,
    interpretarHora,
    sinPuntoDoble,
    TIPOS_AVISO,
    unirFechaHora,
} from '@/utils/salud';
import { campoDelError } from '@/utils/textos';
import { EJEMPLO_HORA } from '@/utils/validaciones';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { CampoHora } from './campo-hora';
import { Campo, MarcaObligatorio, NotaCamposObligatorios } from './campo';
import { ControlSegmentado } from './control-segmentado';
import { Encabezado } from './encabezado';
import { FondoPantalla } from './fondo-pantalla';
import { OpcionesFiltro } from './opciones-filtro';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Errores = Partial<Record<'intervalo' | 'hora' | 'dias' | 'desde' | 'hasta' | 'aviso', string>>;

const INTERVALOS = ['4', '6', '8', '12', '24'].map((v) => ({ valor: v, titulo: `Cada ${v} h` }));

/**
 * Nuevo horario de un medicamento, en un solo formulario. Los campos cambian según la frecuencia:
 * - Cada X horas: cada cuántas horas (1 a 168) y desde qué hora empieza.
 * - Diario: a qué hora.
 * - Algunos días: qué días y a qué hora.
 * Por voz: "cada 8 horas", "todos los días a las 8 de la noche", "lunes y jueves a las 9".
 */
export function FormularioHorario() {
    const { anunciar, colores } = useAccesibilidad();
    const { medicamento: medicamentoId } = useLocalSearchParams<{ medicamento: string }>();
    const id = Number(medicamentoId);

    const [medicamento, setMedicamento] = useState<MedicamentoResponse | null>(null);
    const [frecuencia, setFrecuencia] = useState<TipoFrecuenciaMedicamento>(TipoFrecuenciaMedicamento.DIARIO);
    const [intervalo, setIntervalo] = useState('8');
    const [textoHora, setTextoHora] = useState('');
    const [dias, setDias] = useState<string[]>([]);
    const [desde, setDesde] = useState(() => aDia(new Date()));
    const [textoHasta, setTextoHasta] = useState('');
    const [aviso, setAviso] = useState<TipoRecordatorio>('VOCAL');
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        obtenerMedicamento(id)
            .then(setMedicamento)
            .catch(() => setMedicamento(null));
    }, [id]);

    const quitarError = (c: keyof Errores) => setErrores((e) => (e[c] ? { ...e, [c]: undefined } : e));
    const hora = textoHora.trim() ? interpretarHora(textoHora) : null;
    const hasta = textoHasta.trim() ? interpretarFecha(textoHasta) : null;
    const cadaHoras = frecuencia === TipoFrecuenciaMedicamento.CADA_X_HORAS;
    const conDias = frecuencia === TipoFrecuenciaMedicamento.DIAS_SEMANA;

    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    const opcionesDesde = [
        { valor: aDia(hoy), titulo: 'Hoy' },
        { valor: aDia(manana), titulo: 'Mañana' },
    ];

    /** Resumen en palabras de lo que se va a guardar. */
    const resumen = (() => {
        if (cadaHoras) return hora ? `Cada ${intervalo} horas, empezando ${desde === aDia(hoy) ? 'hoy' : 'mañana'} a las ${horaCorta(unirFechaHora(hoy, hora))}` : null;
        if (!hora) return null;
        const h = horaCorta(unirFechaHora(hoy, hora));
        if (conDias) return dias.length ? `${enumerar(DIAS_SEMANA.filter((d) => dias.includes(d.valor)).map((d) => d.nombre))} a las ${h}` : null;
        return `Todos los días a las ${h}`;
    })();

    const volver = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/paciente/salud/medicamentos/[id]', params: { id: String(id) } }));

    const guardar = async () => {
        const e: Errores = {};
        const n = Number(intervalo);
        if (cadaHoras && (!Number.isInteger(n) || n < 1 || n > 168)) e.intervalo = 'Escribe cada cuántas horas, entre 1 y 168';
        if (!textoHora.trim()) e.hora = cadaHoras ? 'Escribe a qué hora es la primera toma' : 'Escribe la hora';
        else if (!hora) e.hora = `La hora no es válida. ${EJEMPLO_HORA}`;
        if (conDias && dias.length === 0) e.dias = 'Selecciona al menos un día de la semana';
        if (textoHasta.trim() && !hasta) e.hasta = 'No entendí la fecha. Escribe, por ejemplo: 30/10/2026';
        const inicio = hora ? unirFechaHora(deFechaLocal(desde), hora) : null;
        if (hasta && inicio && hasta.getTime() < new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime()) e.hasta = 'La fecha final debe ser posterior a la fecha inicial';
        setErrores(e);
        setErrorGeneral(null);
        if (Object.keys(e).length || !hora || !inicio) {
            anunciar(`Revisa el formulario. ${Object.values(e).join('. ')}`);
            return;
        }
        setGuardando(true);
        try {
            await crearHorario(id, {
                tipoFrecuencia: frecuencia,
                fechaHoraInicio: aFechaHoraLocal(inicio),
                fechaHoraFin: hasta ? aFechaHoraLocal(new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59)) : null,
                intervaloHoras: cadaHoras ? n : null,
                horaProgramada: cadaHoras ? null : aHoraBackend(hora.horas, hora.minutos),
                diasSemana: conDias ? dias : null,
                tipoRecordatorio: aviso,
            });
            const mensaje = sinPuntoDoble(`Listo, agregué el horario: ${resumen?.toLowerCase()}. Te avisaré con ${aviso === 'VOCAL' ? 'voz' : aviso === 'SONORA' ? 'sonido' : 'un aviso visual'}.`);
            anunciar(mensaje);
            dejarAvisoPendiente(mensaje);
            volver();
        } catch (err) {
            const mensaje = mensajeDeError(err, 'No pudimos guardar el horario.');
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/intervalo|horas/i, 'intervalo'],
                [/hora programada/i, 'hora'],
                [/d[ií]a/i, 'dias'],
                [/final|posterior/i, 'hasta'],
                [/inicial|inicio/i, 'desde'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setGuardando(false);
        }
    };

    // ----- Voz ----------------------------------------------------------------------------------

    /** "cada 8 horas", "todos los días a las 8", "lunes y jueves a las 9 de la mañana". */
    const aplicarFrase = (texto: string): boolean => {
        const t = aPalabras(texto);
        let entendio = false;
        const partes: string[] = [];
        const cada = /cada (\d{1,3}|una|dos|tres|cuatro|seis|ocho|doce|veinticuatro) horas?/.exec(t);
        const NUM: Record<string, string> = { una: '1', dos: '2', tres: '3', cuatro: '4', seis: '6', ocho: '8', doce: '12', veinticuatro: '24' };
        if (cada) {
            setFrecuencia(TipoFrecuenciaMedicamento.CADA_X_HORAS);
            setIntervalo(NUM[cada[1]] ?? cada[1]);
            partes.push(`cada ${NUM[cada[1]] ?? cada[1]} horas`);
            entendio = true;
        }
        const elegidos = DIAS_SEMANA.filter((d) => d.claves.some((c) => new RegExp(`\\b${c}`).test(t))).map((d) => d.valor);
        if (/todos los dias|diario|cada dia|diariamente/.test(t)) {
            setFrecuencia(TipoFrecuenciaMedicamento.DIARIO);
            partes.push('todos los días');
            entendio = true;
        } else if (elegidos.length && !cada) {
            setFrecuencia(TipoFrecuenciaMedicamento.DIAS_SEMANA);
            setDias(elegidos);
            partes.push(`los ${enumerar(DIAS_SEMANA.filter((d) => elegidos.includes(d.valor)).map((d) => d.nombre.toLowerCase()))}`);
            entendio = true;
        }
        const conHora = /\ba las? (.+)$/.exec(t) ?? /\bdesde las? (.+)$/.exec(t);
        if (conHora) {
            const h = interpretarHora(conHora[1]);
            if (h) {
                const hora = horaCorta(unirFechaHora(new Date(), h));
                setTextoHora(hora);
                partes.push(`${cada ? 'desde las' : 'a las'} ${hora}`);
                entendio = true;
            }
        }
        if (/con voz|aviso de voz|que me hable/.test(t)) setAviso('VOCAL');
        if (/con sonido|aviso de sonido|que suene/.test(t)) setAviso('SONORA');
        if (/visual|en pantalla/.test(t)) setAviso('VISUAL');
        if (entendio) {
            setErrores({});
            const faltaHora = !conHora && !textoHora.trim();
            anunciar(
                sinPuntoDoble(
                    `Entendido: ${partes.join(' ')}. ` +
                        (faltaHora ? (cada ? '¿A qué hora es la primera toma?' : '¿A qué hora lo tomas?') : 'Di guardar para terminar, o di hasta qué fecha si el tratamiento tiene fin.'),
                ),
            );
        }
        return entendio;
    };

    const campoHora: CampoVoz = {
        claves: ['hora', 'a que hora', 'primera toma'],
        etiqueta: 'Hora',
        pregunta: cadaHoras ? '¿A qué hora es la primera toma?' : '¿A qué hora lo tomas? Por ejemplo: a las 8 de la noche.',
        tipo: 'texto',
        valor: textoHora,
        asignar: (v) => {
            const h = interpretarHora(v);
            // Si lo dictado no es una hora, el campo queda vacío para que VITA la vuelva a preguntar
            setTextoHora(h ? horaCorta(unirFechaHora(new Date(), h)) : '');
            if (h) quitarError('hora');
            else setErrores((e) => ({ ...e, hora: `La hora no es válida. ${EJEMPLO_HORA}` }));
        },
    };
    const campoHasta: CampoVoz = {
        claves: ['hasta', 'hasta cuando', 'termina', 'fecha final'],
        etiqueta: 'Hasta',
        pregunta: '¿Hasta qué fecha? Por ejemplo: 30 de octubre. Si es indefinido, di: sin fecha.',
        tipo: 'texto',
        valor: textoHasta,
        asignar: (v) => setTextoHasta(/^(sin fecha|no|indefinido|siempre|nunca)$/.test(aPalabras(v)) ? '' : v),
        opcional: true,
    };

    const dictado = (texto: string, pendiente: string | null): Resultado[] | null => {
        if (pendiente === 'Hasta') return null;
        const t = aPalabras(texto);
        if (!/(cada|todos los dias|diario|lunes|martes|miercoles|jueves|viernes|sabado|domingo)/.test(t)) return null;
        return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => void aplicarFrase(texto) } }];
    };

    useComandosPantalla({
        titulo: 'Nuevo horario',
        descripcion: `Nuevo horario${medicamento ? ` de ${medicamento.nombre}` : ''}. Dime cada cuánto lo tomas. Por ejemplo: todos los días a las 8 de la noche, cada 8 horas desde las 6 de la mañana, o lunes y jueves a las 9.`,
        ejemplos: ['todos los días a las 8 de la noche', 'cada 8 horas desde las 6 de la mañana', 'lunes, miércoles y viernes a las 9', 'aviso con sonido', 'guardar'],
        campos: [campoHora, campoHasta],
        pasosOpcionales: [{ pregunta: 'Responde sí o no: ¿el tratamiento tiene fecha de fin?', campos: ['Hasta'] }],
        acciones: [
            { frases: ['guardar', 'guarda', 'guardalo', 'listo', 'programar', 'terminar'], etiqueta: 'guardar el horario', ejecutar: () => void guardar() },
            { frases: ['aviso de voz', 'con voz'], ejecutar: () => setAviso('VOCAL') },
            { frases: ['aviso de sonido', 'con sonido'], ejecutar: () => setAviso('SONORA') },
            { frases: ['aviso visual', 'visual'], ejecutar: () => setAviso('VISUAL') },
            { frases: ['empieza manana', 'desde manana'], ejecutar: () => setDesde(aDia(manana)) },
            { frases: ['volver', 'atras', 'regresar', 'cancelar'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado,
    });

    // ----- Pantalla -------------------------------------------------------------------------------

    const alternarDia = (valor: string) => {
        setDias((d) => (d.includes(valor) ? d.filter((x) => x !== valor) : [...d, valor]));
        quitarError('dias');
    };

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} icono="alarma" titulo="Nuevo horario" subtitulo={medicamento ? `${medicamento.nombre}${medicamento.dosis ? ` · ${medicamento.dosis}` : ''}` : undefined} />

            <Tarjeta titulo="¿Cada cuánto lo tomas?" icono="alarma">
                <View style={styles.grupo}>
                    <Texto variante="etiqueta">
                        Frecuencia
                        <MarcaObligatorio />
                    </Texto>
                    <ControlSegmentado
                        etiqueta="Frecuencia"
                        opciones={FRECUENCIAS}
                        valor={frecuencia}
                        onCambiar={(v) => {
                            setFrecuencia(v);
                            setErrores({});
                        }}
                    />
                </View>

                {cadaHoras && (
                    <View style={styles.grupo}>
                        <Texto variante="etiqueta">
                            Cada cuántas horas
                            <MarcaObligatorio />
                        </Texto>
                        <OpcionesFiltro
                            etiqueta="Cada cuántas horas"
                            opciones={INTERVALOS}
                            valor={INTERVALOS.some((o) => o.valor === intervalo) ? intervalo : ''}
                            onCambiar={(v) => {
                                setIntervalo(v);
                                quitarError('intervalo');
                            }}
                        />
                        <Campo
                            etiqueta="Otro intervalo (horas)"
                            icono="reloj"
                            placeholder="Entre 1 y 168"
                            keyboardType="number-pad"
                            value={INTERVALOS.some((o) => o.valor === intervalo) ? '' : intervalo}
                            onChangeText={(v) => {
                                setIntervalo(v);
                                quitarError('intervalo');
                            }}
                            error={errores.intervalo}
                        />
                    </View>
                )}

                {conDias && (
                    <View style={styles.grupo}>
                        <Texto variante="etiqueta">
                            Días
                            <MarcaObligatorio />
                        </Texto>
                        <View style={styles.dias} accessibilityRole="none">
                            {DIAS_SEMANA.map((d) => {
                                const elegido = dias.includes(d.valor);
                                return (
                                    <Pressable
                                        key={d.valor}
                                        onPress={() => alternarDia(d.valor)}
                                        accessibilityRole="checkbox"
                                        accessibilityLabel={d.nombre}
                                        accessibilityState={{ checked: elegido }}
                                        style={[
                                            styles.dia,
                                            { backgroundColor: elegido ? colores.primario : colores.superficie, borderColor: elegido ? colores.primario : colores.borde },
                                        ]}>
                                        <Texto variante="etiqueta" peso="800" color={elegido ? 'sobrePrimario' : 'textoSecundario'}>
                                            {d.corto}
                                        </Texto>
                                    </Pressable>
                                );
                            })}
                        </View>
                        {errores.dias ? (
                            <Texto variante="pequeno" color="error" peso="600">
                                {errores.dias}
                            </Texto>
                        ) : null}
                    </View>
                )}

                <CampoHora
                    etiqueta={cadaHoras ? 'Hora de la primera toma' : 'Hora'}
                    placeholder="Ej: 8:00 p. m."
                    valor={textoHora}
                    onCambiar={setTextoHora}
                    onError={(e) => setErrores((x) => ({ ...x, hora: e }))}
                    error={errores.hora}
                    ayuda={resumen ? `Quedará: ${resumen}` : undefined}
                    obligatorio
                />
            </Tarjeta>

            <Tarjeta titulo="Duración" icono="calendario">
                <View style={styles.grupo}>
                    <Texto variante="etiqueta">
                        Desde
                        <MarcaObligatorio />
                    </Texto>
                    <OpcionesFiltro etiqueta="Desde" opciones={opcionesDesde} valor={desde} onCambiar={setDesde} />
                </View>
                <Campo
                    etiqueta="Hasta"
                    icono="calendario"
                    placeholder="Sin fecha de fin"
                    value={textoHasta}
                    onChangeText={(v) => {
                        setTextoHasta(v);
                        quitarError('hasta');
                    }}
                    error={errores.hasta}
                    ayuda={hasta ? `Último día: ${diaLargo(hasta)}` : 'Déjalo vacío si no tiene fecha de fin.'}
                />
            </Tarjeta>

            <Tarjeta titulo="Aviso" icono="campana">
                <Texto variante="etiqueta">
                    Tipo de aviso
                    <MarcaObligatorio />
                </Texto>
                <ControlSegmentado etiqueta="Tipo de aviso" opciones={TIPOS_AVISO} valor={aviso} onCambiar={setAviso} />
            </Tarjeta>

            <View style={styles.botones}>
                <NotaCamposObligatorios />
                <Boton titulo="Guardar horario" icono="check" onPress={guardar} cargando={guardando} />
                {errorGeneral && <Aviso mensaje={errorGeneral} />}
                <Boton titulo="Cancelar" variante="secundario" onPress={volver} />
            </View>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    grupo: {
        gap: Espacio.s,
    },
    dias: {
        flexDirection: 'row',
        gap: Espacio.xs,
    },
    dia: {
        flex: 1,
        minHeight: 48,
        borderRadius: Radio.s,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});
