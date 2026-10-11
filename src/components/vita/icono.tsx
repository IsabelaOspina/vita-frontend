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