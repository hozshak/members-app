// The introduction of the app, like an assistant: it shows the tabs one after the other (the real screen behind a card) and says
// what is where and what it is for. Once after the first login; "Einführung ansehen" in the profile shows it again. Remembered on
// this phone.
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect, useSyncExternalStore, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/lib/session';
import { getItem, setItem } from '@/lib/storage';
import { radius, space, usePalette } from '@/lib/theme';
import { useZones } from '@/lib/zones';
import { Button, Txt } from './ui';

const KEY = 'members.intro';
let open = false;
let checked = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (!checked) {
    checked = true;
    void getItem(KEY).then((seen) => {
      if (!seen) {
        open = true;
        emit();
      }
    });
  }
  return () => { listeners.delete(l); };
}

/** "Einführung ansehen" in the profile. */
export function showIntro(): void {
  open = true;
  emit();
}

function close() {
  open = false;
  emit();
  void setItem(KEY, '1');
  router.navigate('/' as Href);
}

interface Step { tab: string; icon: keyof typeof Ionicons.glyphMap; title: string; text: string }

export function IntroTour() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community } = useSession();
  const zones = useZones();
  const visible = useSyncExternalStore(subscribe, () => open, () => open);
  const [index, setIndex] = useState(0);

  const steps: Step[] = [
    { tab: '/', icon: 'sparkles', title: `Willkommen bei ${community?.name ?? 'deinem Memberbereich'}`, text: 'Schön, dass du da bist! Ich zeige dir in einer Minute, was wo ist und wofür es gut ist.' },
    { tab: '/', icon: 'home', title: 'Start', text: 'Dein Überblick für heute: das Zitat des Tages, deine Routine mit einem Fingertipp und wie weit du schon bist. Oben rechts kommst du zur WhatsApp-Gruppe und zur Bewertung.' },
    { tab: '/inhalte', icon: 'albums', title: 'Inhalte', text: 'Hier sind deine Programme mit allen Videos, darunter deine Downloads. Mit der Suche findest du jede Lektion. Was du dir merkst, steht in der Merkliste.' },
    { tab: '/routine', icon: 'flame', title: 'Routine', text: 'Dein tägliches Training: Übungen mit Vormachen-Video und Timer, zum Abhaken, die letzten 14 Tage auf einen Blick und deine Fortschrittsfotos. Die Fotos bleiben nur auf deinem Handy.' },
    ...((zones.data?.length ?? 0) > 0
      ? [{ tab: '/routine', icon: 'locate', title: 'Gezielt üben', text: 'Weiter unten in der Routine: Wähle einen Bereich und ein Ziel, 30 Tage oder 3 Monate. Dein Plan sagt dir dann jeden Tag, was dran ist.' } as Step]
      : []),
    { tab: '/profil', icon: 'person-circle', title: 'Profil', text: 'Dein Rahmen um das Profilfoto wird mit jedem Übungstag schöner. Hier stellst du auch deine Erinnerungen ein und kannst diese Einführung noch einmal ansehen.' },
  ];
  const step = steps[Math.min(index, steps.length - 1)] as Step;
  const last = index >= steps.length - 1;
  const tab = step.tab;

  useEffect(() => {
    if (visible) router.navigate(tab as Href);
  }, [tab, visible]);

  if (!visible) return null;
  const finish = () => {
    setIndex(0);
    close();
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={finish} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)', padding: space.l, paddingBottom: insets.bottom + 72 }}>
        <View accessibilityViewIsModal accessibilityLiveRegion="polite" style={{ gap: space.m, padding: space.xl, borderRadius: radius.xl, backgroundColor: p.surface }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={step.icon} size={24} color={p.accent} />
            </View>
            <Txt variant="title" style={{ flex: 1 }}>{step.title}</Txt>
          </View>
          <Txt>{step.text}</Txt>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityLabel={`Schritt ${index + 1} von ${steps.length}`}>
            {steps.map((s, i) => (
              <View key={s.title} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === index ? p.accent : p.line }} />
            ))}
          </View>
          <Button label={last ? 'Los geht’s' : 'Weiter'} onPress={() => (last ? finish() : setIndex(index + 1))} />
          {last ? null : (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={finish} style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
              <Txt variant="small" muted>Überspringen</Txt>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
