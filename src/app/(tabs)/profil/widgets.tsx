// Widgets (owner 11.11.2026: "eine kurze Widget-Erklärung in der App — und gibt es die auch für Android?"): what the three widgets of the app show and how
// to put them on the phone — the steps of the phone in hand (iPhone: home screen and lock screen; Android: home screen). The widgets themselves:
// src/widgets/*.ios.tsx / *.android.tsx, configured in app.json (expo-widgets).
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { Platform, View } from 'react-native';
import { Card, Screen, Section, Txt } from '@/components/ui';
import { radius, space, usePalette } from '@/lib/theme';

const WIDGETS: { icon: keyof typeof Ionicons.glyphMap; name: string; text: string }[] = [
  { icon: 'flame-outline', name: 'Routine', text: 'Deine Serie und die Routine von heute – ein Tipp öffnet sie.' },
  { icon: 'calendar-outline', name: 'Check-in', text: 'Wann dein nächster Check-in kommt.' },
  { icon: 'happy-outline', name: 'Zunge', text: 'Die kleine Erinnerung: Wo ist deine Zunge gerade?' },
];

function Steps({ steps }: { steps: string[] }) {
  const p = usePalette();
  return (
    <View style={{ gap: space.s }}>
      {steps.map((step, i) => (
        <View key={step} style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Txt variant="small" color={p.onAccent} style={{ fontWeight: '700' }}>{i + 1}</Txt>
          </View>
          <Txt style={{ flex: 1 }}>{step}</Txt>
        </View>
      ))}
    </View>
  );
}

export default function WidgetsScreen() {
  const p = usePalette();
  // the name under the app's icon (what the widget list shows)
  const app = Application.applicationName ?? 'THFM';
  const ios = Platform.OS === 'ios';
  return (
    <Screen>
      <Txt muted>Mit Widgets siehst du deine Routine und kleine Erinnerungen direkt auf dem Handy – ohne die App zu öffnen.</Txt>

      <Section title="Diese Widgets gibt es">
        <View style={{ gap: space.s }}>
          {WIDGETS.map((w) => (
            <Card key={w.name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.m, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={w.icon} size={22} color={p.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="heading">{w.name}</Txt>
                <Txt variant="small" muted>{w.text}</Txt>
              </View>
            </Card>
          ))}
        </View>
      </Section>

      {ios ? (
        <>
          <Section title="Auf den Home-Bildschirm">
            <Steps steps={[
              'Auf eine freie Stelle des Home-Bildschirms drücken und halten, bis die Symbole wackeln.',
              'Oben links auf „Bearbeiten“ und dann „Widget hinzufügen“ tippen.',
              `„${app}“ suchen, ein Widget und eine Größe wählen, „Widget hinzufügen“ tippen.`,
            ]} />
          </Section>
          <Section title="Auf den Sperrbildschirm">
            <Steps steps={[
              'Den Sperrbildschirm gedrückt halten und „Anpassen“ tippen.',
              '„Sperrbildschirm“ wählen und auf das Feld unter der Uhr tippen.',
              `„${app}“ wählen und z. B. „Zunge“ antippen, dann „Fertig“.`,
            ]} />
          </Section>
        </>
      ) : (
        <Section title="Auf den Startbildschirm">
          <Steps steps={[
            'Auf eine freie Stelle des Startbildschirms drücken und halten (bei manchen Handys: zwei Finger zusammenziehen).',
            '„Widgets“ tippen.',
            `Zu „${app}“ scrollen, das Widget gedrückt halten und auf den Startbildschirm ziehen.`,
          ]} />
          <Txt variant="small" muted>Die Schritte heißen je nach Handy etwas anders, z. B. „Widgets“ oder „Karten“.</Txt>
        </Section>
      )}

      <Txt variant="small" muted>
        Kein „{app}“ in der Liste? Öffne die App einmal und warte kurz – danach erscheinen die Widgets. Ein Widget zeigt erst etwas, wenn du angemeldet bist.
      </Txt>
    </Screen>
  );
}
