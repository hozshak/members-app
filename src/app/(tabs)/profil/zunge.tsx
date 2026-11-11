// Zungen-Erinnerung (owner 10.11.2026): switch, how many times a day and between which hours; the times it gives; how to put the widget with the small tongue
// on the lock screen. Everything stays on this phone (lib/tongue.ts).
import { Alert, Platform, Pressable, View } from 'react-native';
import { Loading, MenuGroup, Screen, Section, ToggleRow, Txt } from '@/components/ui';
import { setTonguePrefs, TONGUE_QUESTION, TONGUE_TIME_CHOICES, tongueTimesLabel, useTonguePrefs, type TonguePrefs } from '@/lib/tongue';
import { radius, space, usePalette } from '@/lib/theme';

const FROM_HOURS = [7, 8, 9, 10, 11] as const;
const TO_HOURS = [18, 19, 20, 21, 22] as const;

function Choices<T extends number>({ label, values, value, format, onPick }: {
  label: string; values: readonly T[]; value: number; format: (v: T) => string; onPick: (v: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: space.s }}>
      <Txt variant="small" muted>{label}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {values.map((v) => {
          const on = v === value;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onPick(v)}
              style={({ pressed }) => ({
                minWidth: 56, minHeight: 44, paddingHorizontal: space.m, borderRadius: radius.m, alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? p.accent : p.surfaceAlt, opacity: pressed ? 0.7 : 1,
              })}
            >
              <Txt variant="heading" color={on ? p.onAccent : p.text}>{format(v)}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TongueScreen() {
  const p = usePalette();
  const prefs = useTonguePrefs();
  if (!prefs) return <Loading />;

  const save = async (next: TonguePrefs) => {
    const ok = await setTonguePrefs(next);
    if (!ok) Alert.alert('Mitteilungen sind aus', 'Erlaube der App Mitteilungen in den Einstellungen deines Handys, dann kann sie dich an deine Zunge erinnern.');
  };

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      <View style={{ gap: space.s, alignItems: 'center', padding: space.l, borderRadius: radius.l, backgroundColor: p.accentSoft }}>
        <Txt style={{ fontSize: 44, lineHeight: 52 }} accessibilityLabel="Zunge">👅</Txt>
        <Txt variant="title" style={{ textAlign: 'center' }}>{TONGUE_QUESTION}</Txt>
        <Txt muted style={{ textAlign: 'center' }}>Ein paar Mal am Tag tippt dich dein Handy sanft an. So wird die richtige Zungenposition nach und nach zur Gewohnheit.</Txt>
      </View>

      <MenuGroup>
        <ToggleRow label="Zungen-Erinnerung" help={prefs.on ? tongueTimesLabel(prefs) : 'Aus'} value={prefs.on} onValueChange={(on) => void save({ ...prefs, on })} />
      </MenuGroup>

      {prefs.on ? (
        <View style={{ gap: space.l }}>
          <Choices label="Wie oft am Tag?" values={TONGUE_TIME_CHOICES} value={prefs.times} format={(v) => `${v}×`} onPick={(times) => void save({ ...prefs, times })} />
          <Choices label="Ab wann?" values={FROM_HOURS} value={prefs.fromHour} format={(v) => `${v} Uhr`} onPick={(fromHour) => void save({ ...prefs, fromHour })} />
          <Choices label="Bis wann?" values={TO_HOURS} value={prefs.toHour} format={(v) => `${v} Uhr`} onPick={(toHour) => void save({ ...prefs, toHour })} />
        </View>
      ) : null}

      <Section title={Platform.OS === 'ios' ? 'Auf den Sperrbildschirm' : 'Auf den Startbildschirm'}>
        <Txt muted>
          {Platform.OS === 'ios'
            ? 'Mit dem Widget siehst du die kleine Zunge jedes Mal, wenn du aufs Handy schaust: Sperrbildschirm gedrückt halten, „Anpassen“ und „Sperrbildschirm“ tippen, dann auf das Feld unter der Uhr und „THFM“ → „Zunge“ wählen.'
            : 'Mit dem Widget siehst du die kleine Zunge jedes Mal, wenn du aufs Handy schaust: Startbildschirm gedrückt halten, „Widgets“ tippen und „THFM“ → „Zunge“ wählen.'}
        </Txt>
      </Section>
    </Screen>
  );
}
