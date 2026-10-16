import { StyleSheet, View } from "react-native";

import { Espacio, Radio } from "@/constants/vita-theme";
import { useAccesibilidad } from "@/context/accesibilidad-context";
import { EstadoTomaMed } from "@/dto/EstadoTomaMed";
import type { TomaMedicamentoResponse } from "@/dto/TomaMedicamentoResponse";
import { deFechaLocal, horaCorta } from "@/utils/fechas";
import {
  nombreDiaRelativo,
  nombreEstadoToma,
  tomaPorMarcar,
} from "@/utils/salud";

import { Boton } from "./boton";
import { Icono } from "./icono";
import { Texto } from "./texto";

type Props = {
  toma: TomaMedicamentoResponse;
  /** Muestra el día además de la hora (en la semana de un medicamento). */
  conDia?: boolean;
  /** Muestra el nombre del medicamento (en "Hoy"); en el detalle de un medicamento sobra. */
  conNombre?: boolean;
  marcando?: boolean;
  alMarcar?: () => void;
};

/** Una toma de medicamento: hora, qué se toma y su estado, con el botón "Ya lo tomé" si está pendiente. */
export function ElementoToma({
  toma,
  conDia,
  conNombre = true,
  marcando,
  alMarcar,
}: Props) {
  const { colores } = useAccesibilidad();
  const fecha = deFechaLocal(toma.fechaHora);
  const hora = horaCorta(fecha);
  const pendiente = tomaPorMarcar(toma);
  const tomada = toma.estado === EstadoTomaMed.TOMADO;
  const dia = conDia ? nombreDiaRelativo(fecha) : null;
  const titulo = conNombre ? toma.medicamentoNombre : (dia ?? "Toma");
  const detalle = [
    conNombre && dia,
    conNombre && toma.dosis,
    !conNombre && toma.dosis,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={[
        styles.contenedor,
        {
          borderColor: pendiente ? colores.primario : colores.borde,
          backgroundColor: colores.superficie,
        },
      ]}
      accessible={!pendiente}
      accessibilityLabel={`${titulo}${toma.dosis ? `, ${toma.dosis}` : ""}, ${dia ? `${dia}, ` : ""}${hora}: ${nombreEstadoToma(toma.estado).toLowerCase()}`}
    >
      <View style={styles.fila}>
        <View style={styles.hora}>
          <Texto variante="cuerpo" peso="800" centrado>
            {hora.replace(/\s?[ap]\.\s?m\./, "")}
          </Texto>
          <Texto variante="pequeno" color="textoSecundario" centrado>
            {/p\.\s?m\./.test(hora) ? "p. m." : "a. m."}
          </Texto>
        </View>
        <View style={styles.textos}>
          <Texto variante="cuerpo" peso="700" numberOfLines={2}>
            {titulo}
          </Texto>
          {detalle ? (
            <Texto variante="pequeno" color="textoSecundario" numberOfLines={2}>
              {detalle}
            </Texto>
          ) : null}
        </View>
        {!(pendiente && alMarcar) && (
          <View
            style={[
              styles.estado,
              {
                backgroundColor: tomada
                  ? colores.exitoFondo
                  : pendiente
                    ? colores.superficieSuave
                    : colores.errorFondo,
              },
            ]}
          >
            {tomada && (
              <Icono nombre="check" tamano={16} color={colores.exito} />
            )}
            <Texto
              variante="pequeno"
              peso="700"
              style={{
                color: tomada
                  ? colores.exito
                  : pendiente
                    ? colores.textoSecundario
                    : colores.error,
              }}
            >
              {nombreEstadoToma(toma.estado)}
            </Texto>
          </View>
        )}
      </View>
      {pendiente && alMarcar ? (
        <Boton
          titulo="Ya lo tomé"
          onPress={alMarcar}
          cargando={marcando}
          pista={`Marca ${toma.medicamentoNombre} de las ${hora} como tomado`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    gap: Espacio.s,
    borderWidth: 1.5,
    borderRadius: Radio.m,
    padding: Espacio.s,
  },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: Espacio.m,
  },
  hora: {
    width: 58,
  },
  textos: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  estado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Espacio.s,
    paddingVertical: Espacio.xs,
    borderRadius: Radio.s,
  },
});
