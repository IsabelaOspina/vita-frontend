import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Aviso } from '@/components/vita/aviso';
import { Boton } from '@/components/vita/boton';
import { ElementoLista } from '@/components/vita/elemento-lista';
import { Encabezado } from '@/components/vita/encabezado';
import { EstadoCarga } from '@/components/vita/estado-carga';
import { FilaDato } from '@/components/vita/fila-dato';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { AsignacionResponse } from '@/dto/AsignacionResponse';
import {
    asignarPaciente,
    consultarPacientesDeProfesional,
    consultarProfesionalesDePaciente,
    desasignarPaciente,
} from '@/services/adminAsignacionService';
import { listarUsuariosAdmin, reactivarUsuario } from '@/services/adminUsuarioService';
import { desactivarUsuario, obtenerUsuario } from '@/services/usuarioService';
import { mensajeDeError, tokenActual, type Cuenta } from '@/utils/sesion';
import { fechaLarga, nombreDiscapacidad, nombreRol } from '@/utils/textos';

/** La otra persona de una asignación, vista desde la cuenta que se está mirando. */
type Relacionado = { id: number; nombre: string; detalle: string };

/**
 * Detalle de una cuenta para el administrador: sus datos, activar o desactivar la cuenta, y
 * sus asignaciones. Si es un profesional, sus pacientes; si es un paciente, sus profesionales.
 */
export default function CuentaScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const cuentaId = Number(id);
    const { anunciar } = useAccesibilidad();

    const [cuenta, setCuenta] = useState<Cuenta | null>(null);
    const [asignados, setAsignados] = useState<Relacionado[]>([]);
    const [candidatos, setCandidatos] = useState<Cuenta[]>([]);
    /** Especialidades que el paciente ya tiene cubiertas (no puede tener dos profesionales de la misma). */
    const [especialidadesCubiertas, setEspecialidadesCubiertas] = useState<string[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);
    const [ocupado, setOcupado] = useState(false);

    const esProfesional = cuenta?.rol === 'PERSONAL_SALUD';
    const esPaciente = cuenta?.rol === 'USUARIO';

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const token = await tokenActual();
            const datos: Cuenta = await obtenerUsuario(cuentaId, token);
            setCuenta(datos);
            if (datos.rol === 'PERSONAL_SALUD') {
                const [lista, pacientes] = await Promise.all([
                    consultarPacientesDeProfesional(cuentaId),
                    listarUsuariosAdmin(token, 'USUARIO'),
                ]);
                setAsignados(lista.map((a: AsignacionResponse) => ({ id: a.pacienteId, nombre: a.pacienteNombre, detalle: `Asignado el ${fechaLarga(a.fechaAsignacion)}` })));
                setCandidatos(pacientes.filter((p) => p.activo && !lista.some((a) => a.pacienteId === p.id)));
                setEspecialidadesCubiertas([]);
            } else if (datos.rol === 'USUARIO') {
                const [lista, profesionales] = await Promise.all([
                    consultarProfesionalesDePaciente(cuentaId),
                    listarUsuariosAdmin(token, 'PERSONAL_SALUD'),
                ]);
                setAsignados(lista.map((a: AsignacionResponse) => ({ id: a.profesionalId, nombre: a.profesionalNombre, detalle: a.especialidad })));
                setCandidatos(profesionales.filter((p) => p.activo && !lista.some((a) => a.profesionalId === p.id)));
                setEspecialidadesCubiertas(lista.map((a) => a.especialidad));
            } else {
                setAsignados([]);
                setCandidatos([]);
            }
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar la cuenta.'));
        } finally {
            setCargando(false);
        }
    }, [cuentaId]);

    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar]),
    );

    /** Ejecuta una operación, muestra y lee el resultado, y recarga la pantalla. */
    const operar = async (operacion: () => Promise<unknown>, exito: string) => {
        setAviso(null);
        setOcupado(true);
        try {
            await operacion();
            setAviso({ tipo: 'exito', mensaje: exito });
            anunciar(exito);
            await cargar();
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No se pudo completar la operación.');
            setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        } finally {
            setOcupado(false);
        }
    };

    const asignar = (otro: Cuenta) =>
        operar(
            () => (esProfesional ? asignarPaciente(cuentaId, otro.id) : asignarPaciente(otro.id, cuentaId)),
            `${otro.nombre} quedó asignado.`,
        );

    const quitar = (otro: Relacionado) =>
        operar(
            () => (esProfesional ? desasignarPaciente(cuentaId, otro.id) : desasignarPaciente(otro.id, cuentaId)),
            `Se quitó la asignación de ${otro.nombre}.`,
        );

    const cambiarEstado = () => {
        if (!cuenta) return;
        void operar(
            async () => {
                const token = await tokenActual();
                return cuenta.activo ? desactivarUsuario(cuentaId, token) : reactivarUsuario(cuentaId, token);
            },
            `La cuenta quedó ${cuenta.activo ? 'desactivada' : 'activa'}.`,
        );
    };

    /** Por qué no se puede asignar un candidato (o null si sí se puede). */
    const motivoNoAsignable = (otro: Cuenta): string | null => {
        if (!cuenta?.activo) return 'Primero reactiva esta cuenta para poder asignar.';
        const especialidad = otro.personalSalud?.especialidad;
        if (esPaciente && especialidad && especialidadesCubiertas.includes(especialidad)) {
            return `Ya tiene un profesional de ${especialidad}.`;
        }
        return null;
    };

    const datosDeCuenta = cuenta
        ? [
            { etiqueta: 'Estado', valor: cuenta.activo ? 'Activa' : 'Desactivada', icono: cuenta.activo ? ('reactivar' as const) : ('desactivar' as const) },
            { etiqueta: 'Cédula', valor: cuenta.cedula, icono: 'cedula' as const },
            { etiqueta: 'Correo electrónico', valor: cuenta.correo, icono: 'correo' as const },
            ...(cuenta.telefono ? [{ etiqueta: 'Teléfono', valor: cuenta.telefono, icono: 'telefono' as const }] : []),
            ...(cuenta.personalSalud
                ? [
                    { etiqueta: 'Especialidad', valor: cuenta.personalSalud.especialidad, icono: 'medico' as const },
                    { etiqueta: 'Registro profesional', valor: cuenta.personalSalud.numeroRegistroProfesional, icono: 'insignia' as const },
                ]
                : []),
            ...(esPaciente
                ? [
                    {
                        etiqueta: 'Contacto de emergencia',
                        valor: cuenta.contactoEmergencia
                            ? `${cuenta.contactoEmergencia.nombre}, ${cuenta.contactoEmergencia.telefono}`
                            : 'No registrado',
                        icono: 'contactoEmergencia' as const,
                    },
                    {
                        etiqueta: 'Discapacidad',
                        valor: cuenta.discapacidades.length ? cuenta.discapacidades.map((d) => nombreDiscapacidad(d.tipo)).join(', ') : 'No registrada',
                        icono: 'corazon' as const,
                    },
                ]
                : []),
        ]
        : [];

    const queAsigna = esProfesional ? 'pacientes' : 'profesionales';

    useComandosPantalla({
        titulo: 'Detalle de la cuenta',
        descripcion:
            'Detalle de la cuenta. Puedes decir: datos de la cuenta, lee los asignados, lee los disponibles, ' +
            'asigna a, y el nombre, o quita a, y el nombre.',
        ejemplos: ['datos de la cuenta', 'lee los asignados', 'lee los disponibles', 'asigna a Nicole Ocampo', 'quita a Laura Restrepo', 'desactivar cuenta'],
        campos: [],
        listas: [
            {
                claves: ['asignados', 'asignadas', 'pacientes asignados', 'profesionales asignados', 'sus pacientes', 'sus profesionales'],
                nombre: esProfesional ? 'Pacientes asignados' : 'Profesionales asignados',
                vacia: `Todavía no tiene ${queAsigna} asignados.`,
                elementos: asignados.map((a) => ({ nombre: a.nombre, detalle: a.detalle })),
                acciones: [
                    {
                        frases: ['quita', 'quitar', 'desasigna', 'desasignar', 'retira', 'retirar', 'elimina', 'eliminar'],
                        confirmar: (e) => `¿Seguro que quieres quitar la asignación de ${e.nombre}?`,
                        ejecutar: (i) => void quitar(asignados[i]),
                    },
                ],
            },
            {
                claves: ['disponibles', 'lee los disponibles', 'candidatos', 'a quien puedo asignar', 'que puedo asignar'],
                nombre: esProfesional ? 'Pacientes que puedes asignar' : 'Profesionales que puedes asignar',
                vacia: `No hay más ${queAsigna} para asignar.`,
                elementos: candidatos.map((c) => ({ nombre: c.nombre, detalle: c.personalSalud?.especialidad })),
                acciones: [
                    {
                        frases: ['asigna', 'asignar', 'agrega', 'agregar', 'anade', 'anadir'],
                        noAplica: (i) => motivoNoAsignable(candidatos[i]),
                        ejecutar: (i) => void asignar(candidatos[i]),
                    },
                ],
            },
        ],
        acciones: [
            {
                frases: ['datos de la cuenta', 'datos', 'lee los datos', 'informacion', 'quien es'],
                ejecutar: () =>
                    anunciar(
                        cuenta
                            ? [`${cuenta.nombre}, ${nombreRol(cuenta.rol)}`, ...datosDeCuenta.map((d) => `${d.etiqueta}: ${d.valor}`)].join('. ')
                            : 'Todavía estoy cargando la cuenta.',
                    ),
            },
            {
                frases: ['desactivar cuenta', 'desactiva la cuenta', 'desactivar la cuenta', 'desactivar esta cuenta'],
                ejecutar: () =>
                    cuenta?.rol === 'ADMIN'
                        ? anunciar('No se puede desactivar a un administrador.')
                        : cuenta?.activo
                            ? cambiarEstado()
                            : anunciar('La cuenta ya está desactivada.'),
            },
            {
                frases: ['reactivar cuenta', 'reactiva la cuenta', 'activar cuenta', 'activa la cuenta', 'reactivar la cuenta'],
                ejecutar: () => (cuenta && !cuenta.activo ? cambiarEstado() : anunciar('La cuenta ya está activa.')),
            },
            {
                frases: ['volver', 'atras', 'regresar', 'ir al panel', 'volver al panel'],
                ejecutar: () => (router.canGoBack() ? router.back() : router.replace('/admin')),
            },
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                volver
                titulo={cuenta?.nombre ?? 'Cuenta'}
                subtitulo={cuenta ? (cuenta.personalSalud ? `${nombreRol(cuenta.rol)} · ${cuenta.personalSalud.especialidad}` : nombreRol(cuenta.rol)) : undefined}
            />

            <EstadoCarga cargando={cargando} error={error} reintentar={cargar} hayDatos={!!cuenta} />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            {cuenta && (
                <>
                    <Tarjeta titulo="Datos de la cuenta" icono="persona">
                        {datosDeCuenta.map((d) => (
                            <FilaDato key={d.etiqueta} {...d} />
                        ))}
                        {cuenta.rol !== 'ADMIN' && (
                            <Boton
                                titulo={cuenta.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}
                                icono={cuenta.activo ? 'desactivar' : 'reactivar'}
                                variante="secundario"
                                cargando={ocupado}
                                onPress={cambiarEstado}
                            />
                        )}
                    </Tarjeta>

                    {(esProfesional || esPaciente) && (
                        <>
                            <Tarjeta titulo={esProfesional ? 'Pacientes asignados' : 'Profesionales asignados'} icono={esProfesional ? 'pacientes' : 'medico'}>
                                {asignados.length === 0 && (
                                    <Aviso tipo="info" mensaje={`Todavía no tiene ${queAsigna} asignados.`} />
                                )}
                                <View style={styles.lista}>
                                    {asignados.map((a) => (
                                        <ElementoLista
                                            key={a.id}
                                            titulo={a.nombre}
                                            lineas={[a.detalle]}
                                            acciones={[
                                                {
                                                    titulo: 'Quitar',
                                                    icono: 'quitar',
                                                    peligro: true,
                                                    descripcion: `Quitar la asignación de ${a.nombre}`,
                                                    onPress: () => void quitar(a),
                                                },
                                            ]}
                                        />
                                    ))}
                                </View>
                            </Tarjeta>

                            <Tarjeta titulo={esProfesional ? 'Asignar paciente' : 'Asignar profesional'} icono="agregar">
                                {!cuenta.activo && <Aviso tipo="info" mensaje="Reactiva esta cuenta para poder asignar." />}
                                {cuenta.activo && candidatos.length === 0 && <Aviso tipo="info" mensaje={`No hay más ${queAsigna} activos para asignar.`} />}
                                <View style={styles.lista}>
                                    {cuenta.activo &&
                                        candidatos.map((c) => {
                                            const motivo = motivoNoAsignable(c);
                                            return (
                                                <ElementoLista
                                                    key={c.id}
                                                    titulo={c.nombre}
                                                    lineas={[c.personalSalud?.especialidad ?? c.correo]}
                                                    estado={motivo ? { texto: motivo, tipo: 'info' } : undefined}
                                                    acciones={
                                                        motivo
                                                            ? []
                                                            : [
                                                                {
                                                                    titulo: 'Asignar',
                                                                    icono: 'agregar',
                                                                    descripcion: `Asignar a ${c.nombre}`,
                                                                    onPress: () => void asignar(c),
                                                                },
                                                            ]
                                                    }
                                                />
                                            );
                                        })}
                                </View>
                            </Tarjeta>
                        </>
                    )}
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    lista: {
        gap: Espacio.m,
    },
});