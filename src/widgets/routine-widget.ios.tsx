// The home screen widget on the iPhone: the streak and today's routine, a tap opens the Routine tab. Small: streak and today.
// Medium: also the routine's name and this week. Runs in the widget's own runtime, so everything it uses stands inside the
// function (see the `widget` directive of expo-widgets); it never sees the app's state, only RoutineWidgetProps.
import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, monospacedDigit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { RoutineWidgetProps } from './props';

const RoutineWidget = (props: RoutineWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const fg = dark ? '#F7F2EC' : '#241C16';
  const muted = dark ? '#B3A89D' : '#75695E';
  const root = [containerBackground(dark ? '#1C1714' : '#FBF7F2', 'widget'), widgetURL('members://routine')];

  if (!props.hasRoutine) {
    return (
      <VStack alignment="leading" spacing={6} modifiers={root}>
        <Image systemName="flame.fill" color={props.accent} size={26} />
        <Spacer />
        <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(fg)]}>Deine Routine</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(muted)]}>Öffne die App, um loszulegen.</Text>
      </VStack>
    );
  }

  const streakBlock = (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={6}>
        <Image systemName="flame.fill" color={props.accent} size={22} />
        <Text modifiers={[font({ size: 34, weight: 'bold' }), monospacedDigit(), foregroundStyle(fg), minimumScaleFactor(0.6), lineLimit(1)]}>{props.streak}</Text>
      </HStack>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(1)]}>{props.streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}</Text>
    </VStack>
  );
  const todayBlock = props.doneToday ? (
    <HStack spacing={4}>
      <Image systemName="checkmark.circle.fill" color={props.accent} size={15} />
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(fg), lineLimit(1)]}>Heute erledigt</Text>
    </HStack>
  ) : (
    <HStack spacing={4}>
      <Image systemName="play.circle.fill" color={props.accent} size={15} />
      <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(fg), lineLimit(1)]}>{`Heute ${props.minutes} Min.`}</Text>
    </HStack>
  );

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" modifiers={root}>
        {streakBlock}
        <Spacer />
        {todayBlock}
      </VStack>
    );
  }

  return (
    <HStack spacing={16} modifiers={root}>
      <VStack alignment="leading">
        {streakBlock}
        <Spacer />
        {todayBlock}
      </VStack>
      <Spacer />
      <VStack alignment="leading" spacing={8}>
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(fg), lineLimit(2)]}>{props.title}</Text>
        <Spacer />
        <HStack spacing={5}>
          {props.week.map((done, i) => (
            <VStack key={i} spacing={3}>
              <Image systemName={done ? 'checkmark.circle.fill' : 'circle'} color={done ? props.accent : muted} size={15} />
              <Text modifiers={[font({ size: 10 }), foregroundStyle(muted)]}>{['M', 'D', 'M', 'D', 'F', 'S', 'S'][i]}</Text>
            </VStack>
          ))}
        </HStack>
      </VStack>
    </HStack>
  );
};

export default createWidget('RoutineWidget', RoutineWidget, {
  hasRoutine: false, title: '', streak: 0, doneToday: false, minutes: 0, week: [false, false, false, false, false, false, false], accent: '#BD9553',
});
