import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

/**
 * Íconos de VITA. Cada uno tiene su nombre en iOS (SF Symbols) y en
 * Android/web (Material Symbols), así se ven nativos en cada plataforma.
 */
const ICONOS = {
    ojo: { ios: 'eye', android: 'visibility', web: 'visibility' },
    ojoTachado: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
    correo: { ios: 'envelope.fill', android: 'mail', web: 'mail' },
    candado: { ios: 'lock.fill', android: 'lock', web: 'lock' },
    persona: { ios: 'person.fill', android: 'person', web: 'person' },
    personaAgregar: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
    cedula: { ios: 'person.text.rectangle', android: 'id_card', web: 'id_card' },
    microfono: { ios: 'mic.fill', android: 'mic', web: 'mic' },
    contraste: { ios: 'circle.lefthalf.filled', android: 'contrast', web: 'contrast' },
    tamanoTexto: { ios: 'textformat.size', android: 'format_size', web: 'format_size' },
    calendario: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
    sintomas: { ios: 'waveform.path.ecg', android: 'ecg_heart', web: 'ecg_heart' },
    emergencia: { ios: 'light.beacon.max.fill', android: 'emergency', web: 'emergency' },
    corazon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
    ajustes: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
    salir: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
    atras: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
    siguiente: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
    check: { ios: 'checkmark', android: 'check', web: 'check' },
    error: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
    info: { ios: 'info.circle.fill', android: 'info', web: 'info' },
    saludo: { ios: 'hand.wave.fill', android: 'waving_hand', web: 'waving_hand' },
    visual: { ios: 'eye.fill', android: 'visibility', web: 'visibility' },
    auditiva: { ios: 'ear.fill', android: 'hearing', web: 'hearing' },
    cognitiva: { ios: 'brain.head.profile', android: 'psychology', web: 'psychology' },
    habla: { ios: 'bubble.left.and.text.bubble.right.fill', android: 'record_voice_over', web: 'record_voice_over' },
    telefono: { ios: 'phone.fill', android: 'call', web: 'call' },
    parentesco: { ios: 'person.2.fill', android: 'group', web: 'group' },
    contactoEmergencia: { ios: 'cross.case.fill', android: 'contact_emergency', web: 'contact_emergency' },
    medico: { ios: 'stethoscope', android: 'stethoscope', web: 'stethoscope' },
    pacientes: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
    admin: { ios: 'shield.lefthalf.filled', android: 'admin_panel_settings', web: 'admin_panel_settings' },
    agregar: { ios: 'plus', android: 'add', web: 'add' },
    quitar: { ios: 'minus.circle', android: 'remove_circle', web: 'remove_circle' },
    desactivar: { ios: 'person.fill.xmark', android: 'person_off', web: 'person_off' },
    reactivar: { ios: 'person.fill.checkmark', android: 'how_to_reg', web: 'how_to_reg' },
    llave: { ios: 'key.fill', android: 'key', web: 'key' },
    insignia: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
    recargar: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
    casa: { ios: 'house.fill', android: 'home', web: 'home' },
    editar: { ios: 'pencil', android: 'edit', web: 'edit' },
    eliminar: { ios: 'trash.fill', android: 'delete', web: 'delete' },
    grafica: { ios: 'chart.xyaxis.line', android: 'show_chart', web: 'show_chart' },
    reloj: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
    nota: { ios: 'note.text', android: 'notes', web: 'notes' },
    mejorando: { ios: 'arrow.down.right', android: 'trending_down', web: 'trending_down' },
    empeorando: { ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' },
    estable: { ios: 'arrow.right', android: 'trending_flat', web: 'trending_flat' },
    salud: { ios: 'heart.text.square.fill', android: 'health_and_safety', web: 'health_and_safety' },
    medicamento: { ios: 'pills.fill', android: 'medication', web: 'medication' },
    hoy: { ios: 'sun.max.fill', android: 'today', web: 'today' },
    alarma: { ios: 'alarm.fill', android: 'alarm', web: 'alarm' },
    campana: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
    ubicacion: { ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' },
    cancelar: { ios: 'xmark.circle', android: 'cancel', web: 'cancel' },
} satisfies Record<string, SymbolViewProps['name']>;

export type NombreIcono = keyof typeof ICONOS;

type Props = {
    nombre: NombreIcono;
    tamano?: number;
    color: ColorValue;
    style?: StyleProp<ViewStyle>;
};

export function Icono({ nombre, tamano = 24, color, style }: Props) {
    return (
        <SymbolView
            name={ICONOS[nombre]}
            size={tamano}
            tintColor={color}
            style={style}
            // Los íconos son decorativos: el texto que los acompaña es lo que lee el lector de pantalla
            accessible={false}
            importantForAccessibility="no"
        />
    );
}