// The home screen widget on Android: the same moods as on the iPhone (unlit while today is open, red when the streak is in
// danger, burning orange when today is done), with the streak and this week as dots, on the light pink of all widgets. Runs in the widget's own runtime, so
// everything it uses stands inside the function (see the `widget` directive of expo-widgets). Android widgets have no
// timeline: the content stays as the app last sent it. The library offers no "open the app" on a tap yet; the widget only shows.
import { Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, height, paddingAll, size, width } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { RoutineWidgetProps } from './props';

const RoutineWidget = (props: RoutineWidgetProps, _environment: WidgetEnvironment) => {
  'widget';
  // the light pink of all widgets (owner 11.11.2026: #FFE2F0) with dark writing; the mood lives in the line and the dots
  const paper = '#FFE2F0';
  const ink = '#3A1F2B';
  const state = !props.hasRoutine ? 'none' : props.doneToday ? 'done' : props.atRisk ? 'risk' : props.streak > 0 ? 'open' : 'start';
  const mood = state === 'done' ? '#C2410C' : state === 'risk' ? '#C81E24' : ink;
  const dot = state === 'done' ? '#FF8A00' : state === 'risk' ? '#E0241F' : props.accent;
  const headline = state === 'done' ? 'Geschafft!' : state === 'risk' ? `Noch ${props.hoursLeft} Std.` : state === 'none' ? 'Öffne die App' : `Heute ${props.minutes} Min.`;
  const root = [fillMaxSize(), cornerRadius(24), background(paper), paddingAll(16)];

  if (!props.hasRoutine) {
    return (
      <Column modifiers={root} verticalArrangement="center">
        <Text color={ink} style={{ fontSize: 15, fontWeight: 'bold' }}>Deine Routine</Text>
        <Text color={ink} style={{ fontSize: 13 }}>{headline}</Text>
      </Column>
    );
  }
  return (
    <Column modifiers={root} verticalArrangement="spaceBetween">
      <Column>
        <Text color={ink} style={{ fontSize: 40, fontWeight: 'bold' }}>{props.streak > 0 ? String(props.streak) : 'Tag 1'}</Text>
        <Text color={ink} style={{ fontSize: 13 }}>{props.streak === 1 ? 'Tag in Folge' : props.streak > 1 ? 'Tage in Folge' : 'wartet auf dich'}</Text>
      </Column>
      <Column>
        <Text color={mood} style={{ fontSize: 14, fontWeight: 'bold' }}>{headline}</Text>
        <Spacer modifiers={[height(6)]} />
        <Row>
          {props.week.map((done, i) => (
            <Row key={i}>
              <Column modifiers={[size(10, 10), cornerRadius(5), background(done ? dot : '#F2C2D8')]} />
              <Spacer modifiers={[width(4)]} />
            </Row>
          ))}
        </Row>
      </Column>
    </Column>
  );
};

export default createWidget('RoutineWidget', RoutineWidget, {
  hasRoutine: false, title: '', streak: 0, doneToday: false, minutes: 0, week: [false, false, false, false, false, false, false], todayIndex: 0, atRisk: false, hoursLeft: 0, accent: '#BD9553', onAccent: '#111111',
});
