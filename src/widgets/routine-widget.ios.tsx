// The home screen widget on the iPhone, a tap opens the Routine tab. Like Duolingo's it has a mood: an unlit flame while today
// is open, red with the hours left when the streak is in danger in the evening, a burning orange when today is done — on the
// light pink of all widgets (owner 11.11.2026: #FFE2F0) with dark writing. Small: flame, streak, what to do. Medium: also the
// routine and this week as a row of little flames. Lock screen: the streak (circular, rectangular, inline). In tinted modes of
// the home screen the system paints everything in one colour, so nothing there relies on a filled background.
// Runs in the widget's own runtime, so everything it uses stands inside the function (see the `widget` directive of
// expo-widgets); it never sees the app's state, only RoutineWidgetProps.
import { AccessoryWidgetBackground, HStack, Image, Spacer, Text, VStack, ZStack, Circle } from '@expo/ui/swift-ui';
import {
  background, containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, monospacedDigit, offset, opacity, padding, shapes, widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { RoutineWidgetProps } from './props';

const RoutineWidget = (props: RoutineWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily;
  const tinted = environment.widgetRenderingMode === 'accented' || environment.widgetRenderingMode === 'vibrant';
  const white = '#FFFFFF';
  const paper = '#FFE2F0';
  // dark writing on the pink; tinted modes need it light, the system takes over the colour there
  const ink = tinted ? white : '#3A1F2B';
  const state = !props.hasRoutine ? 'none' : props.doneToday ? 'done' : props.atRisk ? 'risk' : props.streak > 0 ? 'open' : 'start';
  const look = {
    none: { flame: props.accent, title: ink, chipBg: props.accent, chipFg: props.onAccent ?? white, headline: 'Deine Routine', icon: 'play.fill' },
    start: { flame: props.accent, title: ink, chipBg: props.accent, chipFg: props.onAccent ?? white, headline: 'Fang heute an', icon: 'play.fill' },
    open: { flame: '#D7A9BE', title: ink, chipBg: props.accent, chipFg: props.onAccent ?? white, headline: 'Heute noch offen', icon: 'play.fill' },
    risk: { flame: '#E0241F', title: tinted ? white : '#C81E24', chipBg: '#E0241F', chipFg: white, headline: 'Serie in Gefahr!', icon: 'hourglass' },
    done: { flame: '#FF8A00', title: tinted ? white : '#C2410C', chipBg: '#EC5310', chipFg: white, headline: 'Geschafft!', icon: 'checkmark' },
  }[state];
  const chipText = state === 'done' ? 'Bis morgen' : state === 'risk' ? `Noch ${props.hoursLeft} Std.` : state === 'none' ? 'App öffnen' : `${props.minutes} Min.`;
  const big = props.streak > 0 ? String(props.streak) : 'Tag 1';
  const small = props.streak === 1 ? 'Tag in Folge' : props.streak > 1 ? 'Tage in Folge' : 'wartet auf dich';
  const root = [
    containerBackground(paper, 'widget'),
    widgetURL('members://routine'),
  ];

  // ---------- lock screen ----------
  if (family === 'accessoryInline') {
    return <Text modifiers={root}>{props.hasRoutine ? `${props.streak} ${props.streak === 1 ? 'Tag' : 'Tage'} · ${props.doneToday ? 'erledigt' : 'heute offen'}` : 'Deine Routine'}</Text>;
  }
  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={root}>
        <AccessoryWidgetBackground />
        <VStack spacing={0}>
          <Image systemName={props.doneToday ? 'flame.fill' : 'flame'} size={15} />
          <Text modifiers={[font({ size: 20, weight: 'bold', design: 'rounded' }), monospacedDigit(), minimumScaleFactor(0.6), lineLimit(1)]}>{String(props.streak)}</Text>
        </VStack>
      </ZStack>
    );
  }
  if (family === 'accessoryRectangular') {
    return (
      <HStack spacing={8} modifiers={root}>
        <Image systemName={props.doneToday ? 'flame.fill' : 'flame'} size={26} />
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), lineLimit(1)]}>{`${props.streak} ${props.streak === 1 ? 'Tag' : 'Tage'} in Folge`}</Text>
          <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{look.headline}</Text>
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // ---------- home screen ----------
  const chip = (
    <HStack spacing={5} modifiers={[padding({ horizontal: 11, vertical: 6 }), ...(tinted ? [] : [background(look.chipBg, shapes.capsule())])]}>
      <Image systemName={look.icon as 'play.fill'} size={11} color={tinted ? white : look.chipFg} />
      <Text modifiers={[font({ size: 13, weight: 'bold', design: 'rounded' }), foregroundStyle(tinted ? white : look.chipFg), lineLimit(1)]}>{chipText}</Text>
    </HStack>
  );
  const streakNumber = (
    <HStack spacing={5}>
      <Image systemName="flame.fill" size={32} color={look.flame} />
      <Text modifiers={[font({ size: props.streak > 0 ? 44 : 34, weight: 'black', design: 'rounded' }), monospacedDigit(), foregroundStyle(ink), minimumScaleFactor(0.5), lineLimit(1)]}>{big}</Text>
    </HStack>
  );
  const smallLine = <Text modifiers={[font({ size: 13, weight: 'semibold', design: 'rounded' }), foregroundStyle(ink), opacity(0.75), lineLimit(1)]}>{small}</Text>;
  // the big flame in the corner, cut off by the edge
  const backFlame = state === 'done' || state === 'risk'
    ? <Image systemName="flame.fill" size={120} color={look.flame} modifiers={[opacity(0.16), offset({ x: 34, y: 34 })]} />
    : null;

  if (family === 'systemSmall') {
    return (
      <ZStack alignment="bottomTrailing" modifiers={root}>
        {backFlame}
        <VStack alignment="leading" spacing={0}>
          {streakNumber}
          {/* evening and done: the message counts more than the words under the number */}
          {state === 'risk' || state === 'done'
            ? <Text modifiers={[font({ size: 15, weight: 'heavy', design: 'rounded' }), foregroundStyle(look.title), minimumScaleFactor(0.75), lineLimit(1)]}>{look.headline}</Text>
            : smallLine}
          <Spacer />
          <HStack>
            {chip}
            <Spacer />
          </HStack>
        </VStack>
      </ZStack>
    );
  }

  const letters = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];
  return (
    <HStack spacing={12} modifiers={root}>
        <VStack alignment="leading" spacing={0}>
          {streakNumber}
          {smallLine}
          <Spacer />
          {chip}
        </VStack>
        <Spacer />
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: 18, weight: 'heavy', design: 'rounded' }), foregroundStyle(look.title), minimumScaleFactor(0.75), lineLimit(1)]}>{look.headline}</Text>
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(ink), opacity(0.75), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          <HStack spacing={3}>
            {props.week.map((done, i) => (
              <VStack key={i} spacing={3}>
                <ZStack modifiers={[frame({ width: 24, height: 24 })]}>
                  {/* a done day: a white flame on a dot in the colour of today's mood (the accent while today is open) */}
                  {done && !tinted ? <Circle modifiers={[foregroundStyle(state === 'done' || state === 'risk' ? look.flame : props.accent)]} /> : null}
                  {!done && i !== props.todayIndex ? <Circle modifiers={[foregroundStyle(ink), opacity(0.08)]} /> : null}
                  {done ? <Image systemName="flame.fill" size={14} color={white} /> : null}
                  {!done && i === props.todayIndex ? <Image systemName="circle" color={ink} modifiers={[font({ size: 24, weight: 'semibold' })]} /> : null}
                </ZStack>
                <Text modifiers={[font({ size: 10, weight: i === props.todayIndex ? 'heavy' : 'medium', design: 'rounded' }), foregroundStyle(ink), opacity(i === props.todayIndex ? 1 : 0.6)]}>{letters[i]}</Text>
              </VStack>
            ))}
          </HStack>
        </VStack>
    </HStack>
  );
};

export default createWidget('RoutineWidget', RoutineWidget, {
  hasRoutine: false, title: '', streak: 0, doneToday: false, minutes: 0, week: [false, false, false, false, false, false, false], todayIndex: 0, atRisk: false, hoursLeft: 0, accent: '#BD9553', onAccent: '#111111',
});
