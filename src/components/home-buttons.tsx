// The buttons of the member start page, as on the website (Einstellungen → Mitgliederbereich → "Startseite: Buttons" of
// the software, e.g. "Bewertung abgeben"): in the app small round buttons at the top right, next to the name. The rating as a gold star with a soft
// pulse, it should catch the eye. Plain https links open the browser. Links to WhatsApp are left out (owner 11.11.2026: "WhatsApp aus den Apps
// rausnehmen" — the app has its own group). The software only sends enabled buttons the member may see. Here too the popup
// that asks for a rating after a month (lib/rating.ts).
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Animated, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { usePulse } from '@/lib/motion';
import { ratingDone, ratingDue, ratingLater } from '@/lib/rating';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import { useActiveTour } from '@/lib/tour';
import type { HomeButtonIcon, MemberHomeButton } from '@/lib/types';
import { Button, Txt } from './ui';

const ICONS: Record<HomeButtonIcon, keyof typeof Ionicons.glyphMap> = {
  chat: 'chatbubbles', star: 'star', link: 'open-outline', camera: 'camera', calendar: 'calendar',
};
const GOLD = '#FFB800';
const STAR = '#FFFFFF';
const SIZE = 44;

const isWhatsApp = (b: MemberHomeButton) => /^https:\/\/(chat\.whatsapp\.com|api\.whatsapp\.com|wa\.me)\//i.test(b.url);
const isLink = (b: MemberHomeButton) => /^https:\/\//i.test(b.url);
/** The buttons the app shows: https links, never WhatsApp. */
export const appHomeButtons = (buttons: MemberHomeButton[] | undefined) => (buttons ?? []).filter((b) => isLink(b) && !isWhatsApp(b));
const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** The rating: a gold circle with a ring that keeps going out from it. */
function RatingButton({ button }: { button: MemberHomeButton }) {
  const pulse = usePulse(1500, 1800);
  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: GOLD,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
        }}
      />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={button.label}
        onPress={() => {
          open(button.url);
          void ratingDone();
        }}
        style={({ pressed }) => ({
          width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD,
          shadowColor: GOLD, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 5,
          opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Ionicons name="star" size={24} color={STAR} />
      </Pressable>
    </View>
  );
}

export function HomeButtons({ buttons }: { buttons: MemberHomeButton[] }) {
  const p = usePalette();
  const links = appHomeButtons(buttons);
  if (links.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: space.s }}>
      {links.map((b) => {
        if (b.icon === 'star') return <RatingButton key={b.id} button={b} />;
        const primary = b.style === 'primary';
        return (
          <Pressable
            key={b.id}
            accessibilityRole="link"
            accessibilityLabel={b.label}
            onPress={() => open(b.url)}
            style={({ pressed }) => ({
              width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center',
              backgroundColor: primary ? p.accent : p.surfaceAlt, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Ionicons name={ICONS[b.icon] ?? 'open-outline'} size={22} color={primary ? p.onAccent : p.text} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** "Deine Tools" (owner 09.11.2026): its own icon next to the buttons, only when the coach entered tools. */
export function ToolsButton() {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Deine Tools"
      onPress={() => router.push('/tools' as Href)}
      style={({ pressed }) => ({
        width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: p.accentSoft, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Ionicons name="bag-handle" size={22} color={p.accent} />
    </Pressable>
  );
}

/** After a month of use, once: the rating, if the member area has a star button. Not while the assistant is showing something. */
export function RatingPrompt({ buttons }: { buttons: MemberHomeButton[] }) {
  const p = usePalette();
  const { community } = useSession();
  const tour = useActiveTour();
  const [due, setDue] = useState(false);
  const star = buttons.find((b) => b.icon === 'star' && isLink(b));

  useFocusEffect(useCallback(() => {
    let alive = true;
    void ratingDue().then((d) => {
      if (alive) setDue(d);
    });
    return () => { alive = false; };
  }, []));

  if (!due || !star || tour) return null;
  const site = /provenexpert/i.test(star.url) ? ' auf ProvenExpert' : '';
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => setDue(false)} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.l, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <View accessibilityViewIsModal style={{ alignItems: 'center', gap: space.m, padding: space.xl, borderRadius: radius.xl, backgroundColor: p.surface }}>
          <View style={[styles.star, { backgroundColor: GOLD }]}>
            <Ionicons name="star" size={34} color={STAR} />
          </View>
          <Txt variant="title" style={{ textAlign: 'center' }}>Schon einen Monat dabei!</Txt>
          <Txt muted style={{ textAlign: 'center' }}>Wie gefällt dir {community?.name ?? 'dein Memberbereich'}? Wir freuen uns über deine ehrliche Bewertung{site}.</Txt>
          <Button
            label={star.label || 'Bewertung abgeben'}
            onPress={() => {
              open(star.url);
              void ratingDone();
              setDue(false);
            }}
            style={{ alignSelf: 'stretch' }}
          />
          <Button
            label="Später"
            kind="secondary"
            onPress={() => {
              void ratingLater();
              setDue(false);
            }}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  star: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
