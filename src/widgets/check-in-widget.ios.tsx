// The check-in widget on the iPhone (owner 06.11.2026): when the next check-in comes, and on its day an invitation in the colour of the community; a tap
// opens the check-in (or the list of check-ins). On the light pink of all widgets (11.11.2026). Small: icon, what is up, a chip. Medium: also a sentence and how many were done. Lock screen: rectangular
// and inline. In tinted modes of the home screen the system paints everything in one colour, so nothing there relies on a filled background.
// Runs in the widget's own runtime, so everything it uses stands inside the function (see the `widget` directive of expo-widgets); it only knows
// CheckInWidgetProps.
import { HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  background, containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, offset, opacity, padding, shapes, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { CheckInWidgetProps } from './props';

const CheckInWidget = (props: CheckInWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily;
  const tinted = environment.widgetRenderingMode === 'accented' || environment.widgetRenderingMode === 'vibrant';
  const white = '#FFFFFF';
  const due = props.state === 'week' || props.state === 'final';
  const when = props.inDays === 1 ? 'morgen' : `in ${props.inDays} Tagen`;
  const text = {
    none: { kicker: 'Check-in', headline: 'Deine Check-ins', line: 'Öffne die App, dann siehst du hier deinen nächsten Check-in.', chip: 'App öffnen', icon: 'list.clipboard' },
    wait: { kicker: 'Check-in', headline: 'Bald dein erster', line: 'Mach deine Routine, dann schlägt dir die App den Check-in vor.', chip: 'Ansehen', icon: 'list.clipboard' },
    soon: { kicker: 'Nächster Check-in', headline: when, line: 'Dann vergleichst du deine Fotos und hörst kurz in dich hinein.', chip: props.count === 1 ? '1 gemacht' : `${props.count} gemacht`, icon: 'calendar' },
    week: { kicker: 'Heute', headline: 'Zeit für deinen Check-in', line: 'Zwei Minuten: Fotos vergleichen und kurz in dich hineinhören.', chip: 'Los geht’s', icon: 'list.clipboard.fill' },
    final: { kicker: 'Geschafft', headline: 'Dein Abschluss-Check', line: 'Vergleich deine Fotos und schau, was sich getan hat.', chip: 'Los geht’s', icon: 'rosette' },
  }[props.state];
  // the light pink of all widgets (owner 11.11.2026: #FFE2F0) with dark writing; on its day the icon takes the deep accent and the chip turns dark, so the
  // day stands out without a second background
  const paper = '#FFE2F0';
  const fg = tinted ? white : '#3A1F2B';
  const iconFg = due && !tinted ? props.accentDeep : fg;
  const chipBg = due ? '#3A1F2B' : props.accent;
  const chipFg = due ? white : props.onAccent;
  const url = due && props.routineId ? `members://routine/check-in?id=${encodeURIComponent(props.routineId)}` : 'members://routine/check-ins';
  const root = [containerBackground(paper, 'widget'), widgetURL(url)];

  // ---------- lock screen ----------
  if (family === 'accessoryInline') {
    return <Text modifiers={root}>{due ? 'Check-in: heute' : props.state === 'soon' ? `Check-in ${when}` : 'Check-in'}</Text>;
  }
  if (family === 'accessoryRectangular') {
    return (
      <HStack spacing={8} modifiers={root}>
        <Image systemName={text.icon as 'calendar'} size={24} />
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{text.kicker}</Text>
          <Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), lineLimit(2), minimumScaleFactor(0.8)]}>{text.headline}</Text>
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // ---------- home screen ----------
  const chip = (
    <HStack spacing={5} modifiers={[padding({ horizontal: 11, vertical: 6 }), ...(tinted ? [] : [background(chipBg, shapes.capsule())])]}>
      <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle(tinted ? white : chipFg), lineLimit(1)]}>{text.chip}</Text>
    </HStack>
  );
  const kicker = <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), foregroundStyle(iconFg), opacity(due ? 1 : 0.7), lineLimit(1)]}>{text.kicker.toUpperCase()}</Text>;
  const headline = (
    <Text modifiers={[font({ size: props.state === 'soon' ? 30 : 19, weight: 'heavy', design: 'rounded' }), foregroundStyle(fg), minimumScaleFactor(0.6), lineLimit(props.state === 'soon' ? 1 : 3)]}>
      {text.headline}
    </Text>
  );
  // the big icon in the corner, cut off by the edge
  const backIcon = <Image systemName={text.icon as 'calendar'} size={110} color={iconFg} modifiers={[opacity(0.1), offset({ x: 30, y: 30 })]} />;

  if (family === 'systemSmall') {
    return (
      <ZStack alignment="bottomTrailing" modifiers={root}>
        {backIcon}
        <VStack alignment="leading" spacing={4}>
          <Image systemName={text.icon as 'calendar'} size={24} color={iconFg} />
          {kicker}
          {headline}
          <Spacer />
          <HStack>
            {chip}
            <Spacer />
          </HStack>
        </VStack>
      </ZStack>
    );
  }

  return (
    <ZStack alignment="bottomTrailing" modifiers={root}>
      {backIcon}
      <HStack spacing={14}>
        <VStack alignment="leading" spacing={4}>
          <HStack spacing={6}>
            <Image systemName={text.icon as 'calendar'} size={20} color={iconFg} />
            {kicker}
          </HStack>
          {headline}
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(fg), opacity(0.75), lineLimit(2)]}>{text.line}</Text>
          <Spacer />
          {chip}
        </VStack>
        <Spacer />
      </HStack>
    </ZStack>
  );
};

export default createWidget('CheckInWidget', CheckInWidget, {
  state: 'none', inDays: 0, count: 0, routineId: '', accent: '#BD9553', accentDeep: '#7B6136', onAccent: '#111111',
});
