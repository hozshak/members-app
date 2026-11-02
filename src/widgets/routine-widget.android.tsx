// The home screen widget on Android: the streak and today's routine. Runs in the widget's own runtime, so everything it uses
// stands inside the function (see the `widget` directive of expo-widgets). Android widgets have no timeline: the content
// stays as the app last sent it. The library offers no "open the app" on a tap yet; the widget only shows.
import { Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, height, paddingAll, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { RoutineWidgetProps } from './props';

const RoutineWidget = (props: RoutineWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const fg = dark ? '#F7F2EC' : '#241C16';
  const muted = dark ? '#B3A89D' : '#75695E';
  const root = [fillMaxSize(), cornerRadius(24), background(dark ? '#1C1714' : '#FBF7F2'), paddingAll(16)];

  if (!props.hasRoutine) {
    return (
      <Column modifiers={root} verticalArrangement="center">
        <Text color={fg} style={{ fontSize: 15, fontWeight: 'bold' }}>Deine Routine</Text>
        <Text color={muted} style={{ fontSize: 13 }}>Öffne die App, um loszulegen.</Text>
      </Column>
    );
  }
  return (
    <Column modifiers={root} verticalArrangement="spaceBetween">
      <Column>
        <Text color={props.accent} style={{ fontSize: 34, fontWeight: 'bold' }}>{String(props.streak)}</Text>
        <Text color={muted} style={{ fontSize: 13 }}>{props.streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}</Text>
      </Column>
      <Column>
        <Text color={fg} style={{ fontSize: 13, fontWeight: 'bold' }}>{props.doneToday ? 'Heute erledigt' : `Heute ${props.minutes} Min.`}</Text>
        <Spacer modifiers={[height(6)]} />
        <Row>
          {props.week.map((done, i) => (
            <Row key={i}>
              <Column modifiers={[size(10, 10), cornerRadius(5), background(done ? props.accent : muted)]} />
              <Spacer modifiers={[width(4)]} />
            </Row>
          ))}
        </Row>
      </Column>
    </Column>
  );
};

export default createWidget('RoutineWidget', RoutineWidget, {
  hasRoutine: false, title: '', streak: 0, doneToday: false, minutes: 0, week: [false, false, false, false, false, false, false], accent: '#BD9553',
});
