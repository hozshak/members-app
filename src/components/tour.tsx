// What the assistant shows (lib/tour.ts): the screen goes dark except for the thing it talks about, which gets a soft pulsing ring, and a card
// next to it says what it is. Items of the tab bar get a circle, and a tap into the circle opens that tab. The native tab bar cannot be
// measured from here: its items are worked out from the width of the screen.
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { usePulse } from '@/lib/motion';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';
import {
  endTour, measureTarget, nextTourStep, scrollTourBy, tabRoutes, useActiveTour, useTourTargetRef, type ActiveTour, type TourId, type TourStep,
} from '@/lib/tour';
import { Button, Txt } from './ui';

/** A rough height of the card, to know whether it fits next to the thing. */
const CARD_H = 240;
const TAB_CIRCLE = 72;

interface Hole { x: number; y: number; w: number; h: number; r: number }
interface Frame { W: number; H: number; top: number; bottom: number }

/** Marks something the assistant can point at. */
export function TourTarget({ id, style, children }: { id: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const ref = useTourTargetRef(id);
  return <View ref={ref} collapsable={false} style={style}>{children}</View>;
}

/**
 * The items of the tab bar share its width. From iOS 26 on the bar floats as a capsule: measured on screenshots of an iPhone 17 Pro, its items
 * start 31 points from the edge and their middle is 52 points above the bottom. (Platform.Version is a text like "26.6.2" there.)
 */
function tabHole(i: number, { W, H, bottom }: Frame): Hole {
  const floating = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;
  const margin = floating ? 31 : 0;
  const cx = margin + ((W - 2 * margin) * (i + 0.5)) / tabRoutes().length;
  const cy = floating ? H - 52 : H - bottom - (Platform.OS === 'android' ? 40 : 25);
  return { x: cx - TAB_CIRCLE / 2, y: cy - TAB_CIRCLE / 2, w: TAB_CIRCLE, h: TAB_CIRCLE, r: TAB_CIRCLE / 2 };
}

const wait = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Where the light falls: brings the thing into view first, so that the card fits next to it. */
async function locate(step: TourStep, tour: TourId, frame: Frame): Promise<Hole | null> {
  if (step.tab !== undefined) return tabHole(Math.max(0, tabRoutes().indexOf(step.tab)), frame);
  if (!step.target) return null;
  let box = await measureTarget(step.target);
  if (!box) return null;
  const { H, top, bottom } = frame;
  const visibleTop = top + space.s;
  const visibleBottom = H - bottom - 64;
  const room = Math.max(box.y - visibleTop, H - bottom - (box.y + box.height));
  if (box.y < visibleTop || box.y + box.height > visibleBottom || room < CARD_H + space.xl) {
    if (scrollTourBy(tour, box.y - visibleTop - space.m)) {
      await wait(380);
      box = (await measureTarget(step.target)) ?? box;
    }
  }
  const pad = 6;
  const y = box.y - pad;
  let h = box.height + 2 * pad;
  // taller than what is left next to the card: only its upper part is lit
  const lowest = H - bottom - space.m - CARD_H - space.l;
  if (y + h > lowest && y - top < CARD_H + space.l) h = Math.max(80, lowest - y);
  return { x: box.x - pad, y, w: box.width + 2 * pad, h, r: h < 72 ? h / 2 : radius.l + pad };
}

/** The dark screen with a hole. */
function roundedRect({ x, y, w, h, r }: Hole): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function Ring({ hole, color }: { hole: Hole; color: string }) {
  const pulse = usePulse(1300, 300);
  const box = { position: 'absolute' as const, left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: hole.r };
  return (
    <>
      <View pointerEvents="none" style={[box, { borderWidth: 3, borderColor: color }]} />
      <Animated.View
        pointerEvents="none"
        style={[box, {
          borderWidth: 3, borderColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, hole.w > 120 ? 1.04 : 1.25] }) }],
        }]}
      />
    </>
  );
}

function Spot({ active }: { active: ActiveTour }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community } = useSession();
  const { width: W, height: H } = useWindowDimensions();
  const step = active.steps[active.index] as TourStep;
  const last = active.index >= active.steps.length - 1;
  const [place, setPlace] = useState<{ hole: Hole | null } | null>(null);

  useEffect(() => {
    let alive = true;
    void locate(step, active.tour, { W, H, top: insets.top, bottom: insets.bottom }).then((hole) => {
      if (alive) setPlace({ hole });
    });
    return () => { alive = false; };
  }, [step, active.tour, W, H, insets.top, insets.bottom]);

  const hole = place?.hole ?? null;
  const below = !!hole && hole.y + hole.h / 2 < H / 2;
  const edge = space.l;
  const cardPlace: ViewStyle = !hole
    ? { top: 0, bottom: 0, justifyContent: 'center' }
    : below ? { top: hole.y + hole.h + space.m } : { bottom: H - hole.y + space.m };
  const caretLeft = hole ? Math.max(radius.xl, Math.min(W - 2 * edge - radius.xl - 16, hole.x + hole.w / 2 - edge - 8)) : 0;
  const tabRoute = step.tab ?? null;
  const title = step.title.replace('{name}', community?.name ?? 'deinem Memberbereich');

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={`M0 0H${W}V${H}H0Z${hole ? roundedRect(hole) : ''}`} fill="rgba(0,0,0,0.68)" fillRule="evenodd" />
      </Svg>
      {hole ? <Ring hole={hole} color="#FFFFFF" /> : null}
      {hole && tabRoute ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${step.title} öffnen`}
          onPress={() => {
            endTour();
            router.navigate(tabRoute as Href);
          }}
          style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: hole.r }}
        />
      ) : null}
      {place ? (
        <View pointerEvents="box-none" style={[{ position: 'absolute', left: edge, right: edge }, cardPlace]}>
          <View accessibilityViewIsModal accessibilityLiveRegion="polite" style={{ gap: space.m, padding: space.xl, borderRadius: radius.xl, backgroundColor: p.surface }}>
            {hole ? (
              <View style={[{ position: 'absolute', left: caretLeft, width: 16, height: 16, backgroundColor: p.surface, transform: [{ rotate: '45deg' }] }, below ? { top: -8 } : { bottom: -8 }]} />
            ) : null}
            <Txt variant="title">{title}</Txt>
            <Txt>{step.text}</Txt>
            {active.steps.length > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityLabel={`Schritt ${active.index + 1} von ${active.steps.length}`}>
                {active.steps.map((s, i) => (
                  <View key={`${s.title}${i}`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === active.index ? p.accent : p.line }} />
                ))}
              </View>
            ) : null}
            <Button label={last ? 'Verstanden' : 'Weiter'} onPress={nextTourStep} />
            {last ? null : (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={endTour} style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
                <Txt variant="small" muted>Überspringen</Txt>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function TourOverlay() {
  const active = useActiveTour();
  if (!active) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={endTour} statusBarTranslucent navigationBarTranslucent>
      <Spot key={`${active.tour}:${active.index}`} active={active} />
    </Modal>
  );
}
