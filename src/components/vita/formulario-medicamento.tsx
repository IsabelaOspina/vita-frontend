import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { actualizarMedicamento, crearMedicamento, obtenerMedicamento } from '@/services/medicamentoService';
import { aPalabras, type CampoVoz } from '@/utils/comandos-voz';
import { dejarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { campoDelError } from '@/utils/textos';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Campo, NotaCamposObligatorios } from './campo';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { OpcionesFiltro } from './opciones-filtro';
import { separarMedicamento } from './pantalla-medicamentos';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Errores = Partial<Record<'nombre' | 'dosis' | 'frecuencia' | 'via', string>>;

const VIAS = ['Oral', 'Sublingual', 'Inyectada', 'Inhalada', 'Tópica', 'Gotas'];

const sinNada = (v: string) => /^(no|ninguna|ninguno|nada)$/.test(aPalabras(v));

/**
 * Registrar o editar un medicamento. Solo el nombre es obligatorio; dosis, frecuencia (en
 * palabras) y vía son datos de apoyo. Los horarios se agregan después, en el detalle.
 */
export function FormularioMedicamento({ id }: { id?: number }) {
    const editando = id !== undefined;
    const { anunciar } = useAccesibilidad();
    const inicial = useLocalSearchParams<{ nombre?: string; dosis?: string }>();

    const [nombre, setNombre] = useState(editando ? '' : (inicial.nombre ?? ''));
    const [dosis, setDosis] = useState(editando ? '' : (inicial.dosis ?? ''));
    const [frecuencia, setFrecuencia] = useState('');
    const [via, setVia] = useState('');
    const [cargandoDatos, setCargandoDatos] = useState(editando);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const quitarError = (c: keyof Errores) => setErrores((e) => (e[c] ? { ...e, [c]: undefined } : e));

    const cargar = async () => {
        if (id === undefined) return;
        setCargandoDatos(true);
        setErrorCarga(null);
        try {
            const m = await obtenerMedicamento(id);
            setNombre(m.nombre);
            setDosis(m.dosis ?? '');
            setFrecuencia(m.frecuencia ?? '');
            setVia(m.viaAdministracion ?? '');
        } catch (e) {
            setErrorCarga(mensajeDeError(e, 'No pudimos cargar el medicamento.'));
        } finally {
            setCargandoDatos(false);
        }
    };

    useEffect(() => {
        void cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud/medicamentos'));

    const guardar = async () => {
        const e: Errores = {};
        if (!nombre.trim()) e.nombre = 'Escribe el nombre del medicamento';
        else if (nombre.trim().length > 150) e.nombre = 'El nombre no puede superar 150 caracteres';
        if (dosis.trim().length > 100) e.dosis = 'La dosis no puede superar 100 caracteres';
        if (frecuencia.trim().length > 120) e.frecuencia = 'La frecuencia no puede superar 120 caracteres';
        if (via.trim().length > 100) e.via = 'La vía de administración no puede superar 100 caracteres';
        setErrores(e);
        setErrorGeneral(null);
        if (Object.keys(e).length) {
            anunciar(`Revisa el formulario. ${Object.values(e).join('. ')}`);
            return;
        }
        const datos = {
            nombre: nombre.trim(),
            dosis: dosis.trim() || null,
            frecuencia: frecuencia.trim() || null,
            viaAdministracion: via.trim() || null,
        };
        setGuardando(true);
        try {
            if (id !== undefined) {
                const m = await actualizarMedicamento(id, datos);
                const mensaje = `Listo, guardé los cambios de ${m.nombre}.`;
                anunciar(mensaje);
                dejarAvisoPendiente(mensaje);
                volver();
            } else {
                const m = await crearMedicamento(datos);
                const mensaje = `Listo, registré ${m.nombre}. Ahora agrega su horario para que VITA te recuerde cada toma.`;
                anunciar(mensaje);
                dejarAvisoPendiente(mensaje);
                router.replace({ pathname: '/paciente/salud/medicamentos/[id]', params: { id: String(m.id) } });
            }
        } catch (err) {
            const mensaje = mensajeDeError(err, 'No pudimos guardar el medicamento.');
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/nombre/i, 'nombre'],
                [/dosis/i, 'dosis'],
                [/frecuencia/i, 'frecuencia'],
                [/v[ií]a/i, 'via'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setGuardando(false);
        }
    };

    const campoNombre: CampoVoz = {
        claves: ['nombre', 'se llama', 'medicamento'],
        etiqueta: 'Nombre',
        pregunta: '¿Cómo se llama el medicamento? Puedes decir también la dosis, por ejemplo: metformina 850 miligramos.',
        tipo: 'texto',
        valor: nombre,
        asignar: (v) => {
            const partes = separarMedicamento(v);
            setNombre(partes.nombre);
            if (partes.dosis) setDosis(partes.dosis);
            quitarError('nombre');
        },
    };
    const campoDosis: CampoVoz = {
        claves: ['dosis', 'cantidad'],
        etiqueta: 'Dosis',
        pregunta: '¿Qué dosis? Por ejemplo: 50 miligramos o una tableta.',
        tipo: 'texto',
        valor: dosis,
        asignar: (v) => setDosis(sinNada(v) ? '' : separarMedicamento(`x ${v}`).dosis ?? v),
        opcional: true,
    };
    const campoFrecuencia: CampoVoz = {
        claves: ['frecuencia', 'cada cuanto', 'indicacion', 'indicaciones'],
        etiqueta: 'Frecuencia',
        pregunta: '¿Cada cuánto te lo indicaron? Por ejemplo: cada 8 horas con las comidas.',
        tipo: 'texto',
        valor: frecuencia,
        asignar: (v) => setFrecuencia(sinNada(v) ? '' : v.charAt(0).toUpperCase() + v.slice(1)),
        opcional: true,
    };
    const campoVia: CampoVoz = {
        claves: ['via', 'via de administracion', 'como se toma', 'como lo tomo'],
        etiqueta: 'Vía',
        pregunta: '¿Cómo se toma? Por ejemplo: oral, inyectada o inhalada.',
        tipo: 'texto',
        valor: via,
        asignar: (v) => setVia(sinNada(v) ? '' : v.charAt(0).toUpperCase() + v.slice(1)),
        opcional: true,
    };

    const titulo = editando ? 'Editar medicamento' : 'Nuevo medicamento';

    useComandosPantalla({
        titulo,
        descripcion: editando
            ? 'Editar medicamento. Dime qué quieres cambiar, por ejemplo: la dosis es 100 miligramos, y luego di: guardar.'
            : 'Nuevo medicamento. Dime el nombre y la dosis, por ejemplo: losartán 50 miligramos.',
        ejemplos: ['losartán 50 miligramos', 'la vía es oral', 'la frecuencia es cada 12 horas', 'guardar'],
        campos: editando && cargandoDatos ? [] : [campoNombre, campoDosis, campoFrecuencia, campoVia],
        pasosOpcionales: editando ? [] : [{ pregunta: 'Responde sí o no: ¿quieres agregar la dosis, la frecuencia o la vía?', campos: ['Dosis', 'Frecuencia', 'Vía'] }],
        acciones: [
            { frases: ['guardar', 'guarda', 'guardalo', 'listo', 'registrar', 'terminar'], etiqueta: editando ? 'guardar los cambios' : 'guardar el medicamento', ejecutar: () => void guardar() },
            { frases: ['volver', 'atras', 'regresar', 'cancelar', 'no guardar'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} icono="medicamento" titulo={titulo} subtitulo="Los horarios se agregan después, en el medicamento." />

            {editando && cargandoDatos ? (
                <EstadoCarga cargando={cargandoDatos} error={errorCarga} reintentar={cargar} hayDatos={false} />
            ) : (
                <>
                    <Tarjeta titulo="Medicamento" icono="medicamento">
                        <Campo
                            etiqueta="Nombre"
                            icono="medicamento"
                            placeholder="Ej: Losartán"
                            value={nombre}
                            onChangeText={(v) => {
                                setNombre(v);
                                quitarError('nombre');
                            }}
                            error={errores.nombre}
                            maxLength={150}
                            obligatorio
                        />
                        <Campo
                            etiqueta="Dosis"
                            icono="info"
                            placeholder="Ej: 50 mg"
                            value={dosis}
                            onChangeText={(v) => {
                                setDosis(v);
                                quitarError('dosis');
                            }}
                            error={errores.dosis}
                            maxLength={100}
                        />
                    </Tarjeta>

                    <Tarjeta titulo="Detalles adicionales" icono="nota">
                        <Campo
                            etiqueta="Frecuencia indicada"
                            icono="reloj"
                            placeholder="Ej: Cada 12 horas con las comidas"
                            ayuda="Como te lo indicó el médico. Los avisos se programan en «Horarios»."
                            value={frecuencia}
                            onChangeText={(v) => {
                                setFrecuencia(v);
                                quitarError('frecuencia');
                            }}
                            error={errores.frecuencia}
                            maxLength={120}
                        />
                        <View style={styles.grupo}>
                            <Texto variante="etiqueta">Vía de administración</Texto>
                            <OpcionesFiltro
                                etiqueta="Vía de administración"
                                opciones={VIAS.map((v) => ({ valor: v, titulo: v }))}
                                valor={VIAS.find((v) => aPalabras(v) === aPalabras(via)) ?? ''}
                                onCambiar={(v) => {
                                    setVia(v);
                                    quitarError('via');
                                }}
                            />
                        </View>
                        <Campo
                            etiqueta="Otra vía"
                            icono="nota"
                            placeholder="Ej: Parche en la piel"
                            value={VIAS.some((v) => aPalabras(v) === aPalabras(via)) ? '' : via}
                            onChangeText={(v) => {
                                setVia(v);
                                quitarError('via');
                            }}
                            error={errores.via}
                            maxLength={100}
                        />
                    </Tarjeta>

                    <View style={styles.botones}>
                        <NotaCamposObligatorios />
                        <Boton titulo={editando ? 'Guardar cambios' : 'Guardar medicamento'} icono="check" onPress={guardar} cargando={guardando} />
                        {errorGeneral && <Aviso mensaje={errorGeneral} />}
                        <Boton titulo="Cancelar" variante="secundario" onPress={volver} />
                    </View>
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    grupo: {
        gap: Espacio.s,
    },
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});
