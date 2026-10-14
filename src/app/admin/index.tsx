import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { accionesComunesVoz, salir } from '@/components/vita/acciones-cuenta';
import { Aviso } from '@/components/vita/aviso';
import { ChipSeleccion } from '@/components/vita/chip-seleccion';
import { ElementoLista } from '@/components/vita/elemento-lista';
import { Encabezado } from '@/components/vita/encabezado';
import { EstadoCarga } from '@/components/vita/estado-carga';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import type { NombreIcono } from '@/components/vita/icono';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { Rol } from '@/dto/Rol';
import { listarUsuariosAdmin, reactivarUsuario } from '@/services/adminUsuarioService';
import { desactivarUsuario } from '@/services/usuarioService';
import { mensajeDeError, tokenActual, type Cuenta } from '@/utils/sesion';
import { nombreRol } from '@/utils/textos';

type Filtro = 'TODOS' | Rol;

const FILTROS: { filtro: Filtro; titulo: string; icono: NombreIcono; plural: string }[] = [
  { filtro: 'TODOS', titulo: 'Todas', icono: 'pacientes', plural: 'cuentas' },
  { filtro: 'USUARIO', titulo: 'Pacientes', icono: 'persona', plural: 'pacientes' },
  { filtro: 'PERSONAL_SALUD', titulo: 'Personal de salud', icono: 'medico', plural: 'profesionales de salud' },
];

/** Detalle de cada cuenta en la lista: rol, especialidad (si es profesional) y correo. */
function detalleDe(cuenta: Cuenta) {
  const rol = cuenta.personalSalud ? `${nombreRol(cuenta.rol)}, ${cuenta.personalSalud.especialidad}` : nombreRol(cuenta.rol);
  return [rol, cuenta.correo];
}

/** Panel del administrador: cuentas del sistema, registrar profesionales y activar o desactivar cuentas. */
export default function AdminScreen() {
  const { anunciar } = useAccesibilidad();

  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

  // Al volver de "Registrar profesional" llega el nombre del profesional creado
  const { creado } = useLocalSearchParams<{ creado?: string }>();
  useEffect(() => {
    if (!creado) return;
    setAviso({ tipo: 'exito', mensaje: `${creado} quedó registrado como profesional de salud.` });
    router.setParams({ creado: undefined });
  }, [creado]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setCuentas(await listarUsuariosAdmin(await tokenActual()));
    } catch (e) {
      setError(mensajeDeError(e, 'No pudimos cargar las cuentas.'));
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
      useCallback(() => {
        void cargar();
      }, [cargar]),
  );

  // El filtro se aplica aquí (todas las cuentas ya están cargadas)
  const visibles = filtro === 'TODOS' ? cuentas : cuentas.filter((c) => c.rol === filtro);

  const elegirFiltro = (nuevo: Filtro) => {
    setFiltro(nuevo);
    const datos = FILTROS.find((f) => f.filtro === nuevo)!;
    const cantidad = nuevo === 'TODOS' ? cuentas.length : cuentas.filter((c) => c.rol === nuevo).length;
    anunciar(`Mostrando ${cantidad} ${datos.plural}`);
  };

  const verCuenta = (cuenta: Cuenta) => router.push({ pathname: '/admin/cuenta/[id]', params: { id: String(cuenta.id) } });

  const cambiarEstado = async (cuenta: Cuenta) => {
    setAviso(null);
    try {
      const token = await tokenActual();
      if (cuenta.activo) await desactivarUsuario(cuenta.id, token);
      else await reactivarUsuario(cuenta.id, token);
      const mensaje = `La cuenta de ${cuenta.nombre} quedó ${cuenta.activo ? 'desactivada' : 'activa'}.`;
      setAviso({ tipo: 'exito', mensaje });
      anunciar(mensaje);
      await cargar();
    } catch (e) {
      const mensaje = mensajeDeError(e, 'No se pudo cambiar el estado de la cuenta.');
      setAviso({ tipo: 'error', mensaje });
      anunciar(mensaje);
    }
  };

  useComandosPantalla({
    titulo: 'Cuentas',
    descripcion:
        'Cuentas. Aquí están las cuentas de VITA. ' +
        'Puedes decir: lee las cuentas, registrar profesional, mostrar pacientes, o desactiva a, y el nombre.',
    ejemplos: [
      'lee las cuentas',
      'registrar profesional',
      'mostrar personal de salud',
      'ver a María Gómez',
      'desactiva a Jorge Ríos',
      'reactiva a Jorge Ríos',
    ],
    campos: [],
    listas: [
      {
        claves: ['cuentas', 'las cuentas', 'lista', 'usuarios', 'lee la lista'],
        nombre: 'Cuentas',
        vacia: 'No hay cuentas para mostrar.',
        elementos: visibles.map((c) => ({
          nombre: c.nombre,
          detalle: `${detalleDe(c)[0]}${c.activo ? '' : ', desactivada'}`,
        })),
        acciones: [
          {
            frases: ['ver', 'abre', 'abrir', 'entra a', 'muestra', 'mostrar', 'detalle de'],
            ejecutar: (i) => verCuenta(visibles[i]),
          },
          {
            frases: ['desactiva', 'desactivar', 'bloquea', 'bloquear'],
            noAplica: (i) =>
                visibles[i].rol === 'ADMIN'
                    ? 'No se puede desactivar a un administrador.'
                    : !visibles[i].activo
                        ? `La cuenta de ${visibles[i].nombre} ya está desactivada.`
                        : null,
            confirmar: (e) => `¿Seguro que quieres desactivar la cuenta de ${e.nombre}?`,
            ejecutar: (i) => void cambiarEstado(visibles[i]),
          },
          {
            frases: ['reactiva', 'reactivar', 'activa', 'activar'],
            noAplica: (i) => (visibles[i].activo ? `La cuenta de ${visibles[i].nombre} ya está activa.` : null),
            ejecutar: (i) => void cambiarEstado(visibles[i]),
          },
        ],
      },
    ],
    acciones: [
      {
        frases: ['registrar profesional', 'registrar un profesional', 'nuevo profesional', 'agregar profesional', 'crear profesional', 'registrar personal'],
        ejecutar: () => router.navigate('/admin/nuevo-personal'),
      },
      {
        frases: ['mostrar pacientes', 'ver pacientes', 'solo pacientes', 'los pacientes', 'filtra pacientes'],
        ejecutar: () => elegirFiltro('USUARIO'),
      },
      {
        frases: ['personal de salud', 'profesionales', 'ver personal', 'solo personal', 'mostrar personal'],
        ejecutar: () => elegirFiltro('PERSONAL_SALUD'),
      },
      {
        frases: ['mostrar todas', 'mostrar todos', 'ver todas', 'ver todos', 'todas las cuentas', 'quitar filtro'],
        ejecutar: () => elegirFiltro('TODOS'),
      },
      ...accionesComunesVoz('ADMIN', anunciar),
    ],
  });

  return (
      <FondoPantalla>
        <Encabezado
            alCerrarSesion={() => salir(anunciar)}
            icono="admin"
            titulo="Cuentas"
            subtitulo="Pacientes y personal de salud de VITA."
        />


        <Tarjeta>
          <View style={styles.filtros} accessibilityRole="radiogroup" accessibilityLabel="Mostrar">
            {FILTROS.map((f) => (
                <View key={f.filtro} style={styles.filtro}>
                  <ChipSeleccion
                      titulo={f.titulo}
                      icono={f.icono}
                      seleccionado={filtro === f.filtro}
                      onPress={() => elegirFiltro(f.filtro)}
                  />
                </View>
            ))}
          </View>

          {aviso && <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />}

          <EstadoCarga cargando={cargando} error={error} reintentar={cargar} hayDatos={visibles.length > 0} vacio="No hay cuentas para mostrar." />

          <View style={styles.lista}>
            {visibles.map((cuenta) => (
                <ElementoLista
                    key={cuenta.id}
                    titulo={cuenta.nombre}
                    lineas={detalleDe(cuenta)}
                    estado={cuenta.activo ? undefined : { texto: 'Desactivada', tipo: 'error' }}
                    onPress={() => verCuenta(cuenta)}
                    descripcionPress="Abre el detalle y las asignaciones"
                    acciones={
                      cuenta.rol === 'ADMIN'
                          ? []
                          : [
                            cuenta.activo
                                ? {
                                  titulo: 'Desactivar',
                                  icono: 'desactivar' as const,
                                  peligro: true,
                                  descripcion: `Desactivar la cuenta de ${cuenta.nombre}`,
                                  onPress: () => void cambiarEstado(cuenta),
                                }
                                : {
                                  titulo: 'Reactivar',
                                  icono: 'reactivar' as const,
                                  descripcion: `Reactivar la cuenta de ${cuenta.nombre}`,
                                  onPress: () => void cambiarEstado(cuenta),
                                },
                          ]
                    }
                />
            ))}
          </View>
        </Tarjeta>

      </FondoPantalla>
  );
}

const styles = StyleSheet.create({
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Espacio.s,
  },
  filtro: {
    flexGrow: 1,
    flexBasis: 120,
  },
  lista: {
    gap: Espacio.m,
  },
});