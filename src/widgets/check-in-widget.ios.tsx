// The check-in widget on the iPhone (owner 06.11.2026): when the next check-in comes, and on its day an invitation in the colour of the community; a tap
// opens the check-in (or the list of check-ins). Small: icon, what is up, a chip. Medium: also a sentence and how many were done. Lock screen: rectangular
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
  const bg = due ? [props.accent, props.accentDeep] : ['#3A2F28', '#1C1613'];
  const fg = due ? props.onAccent : white;
  const chipBg = due ? fg : props.accent;
  // on its day the chip takes the colour of the text; on a dark chip the accent itself reads better than its deep shade
  const chipFg = due ? (fg === white ? props.accentDeep : props.accent) : props.onAccent;
  const url = due && props.routineId ? `members://routine/check-in?id=${encodeURIComponent(props.routineId)}` : 'members://routine/check-ins';
  const root = [containerBackground({ type: 'linearGradient', colors: bg, startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } }, 'widget'), widgetURL(url)];

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
  const kicker = <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), foregroundStyle(fg), opacity(0.8), lineLimit(1)]}>{text.kicker.toUpperCase()}</Text>;
  const headline = (
    <Text modifiers={[font({ size: props.state === 'soon' ? 30 : 19, weight: 'heavy', design: 'rounded' }), foregroundStyle(fg), minimumScaleFactor(0.6), lineLimit(props.state === 'soon' ? 1 : 3)]}>
      {text.headline}
    </Text>
  );
  // the big icon in the corner, cut off by the edge
  const backIcon = <Image systemName={text.icon as 'calendar'} size={110} color={fg} modifiers={[opacity(0.12), offset({ x: 30, y: 30 })]} />;

  if (family === 'systemSmall') {
    return (
      <ZStack alignment="bottomTrailing" modifiers={root}>
        {backIcon}
        <VStack alignment="leading" spacing={4}>
          <Image systemName={text.icon as 'calendar'} size={24} color={fg} />
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
            <Image systemName={text.icon as 'calendar'} size={20} color={fg} />
            {kicker}
          </HStack>
          {headline}
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(fg), opacity(0.85), lineLimit(2)]}>{text.line}</Text>
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
