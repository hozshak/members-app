// The check-in widget on Android: the same states as on the iPhone (dark while the next one is to come, the community's colour on its day). Runs in the
// widget's own runtime, so everything it uses stands inside the function (see the `widget` directive of expo-widgets). Android widgets have no timeline and the
// library offers no "open the app" on a tap yet: the content stays as the app last sent it.
import { Column, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, height, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { CheckInWidgetProps } from './props';

const CheckInWidget = (props: CheckInWidgetProps, _environment: WidgetEnvironment) => {
  'widget';
  const due = props.state === 'week' || props.state === 'final';
  const fg = due ? props.onAccent : '#FFFFFF';
  const kicker = props.state === 'soon' ? 'Nächster Check-in' : due ? 'Heute' : 'Check-in';
  const headline = props.state === 'soon' ? (props.inDays === 1 ? 'morgen' : `in ${props.inDays} Tagen`)
    : props.state === 'week' ? 'Zeit für deinen Check-in'
      : props.state === 'final' ? 'Dein Abschluss-Check'
        : props.state === 'wait' ? 'Bald dein erster' : 'Öffne die App';
  return (
    <Column modifiers={[fillMaxSize(), cornerRadius(24), background(due ? props.accent : '#2A221D'), paddingAll(16)]} verticalArrangement="spaceBetween">
      <Column>
        <Text color={fg} style={{ fontSize: 12, fontWeight: 'bold' }}>{kicker.toUpperCase()}</Text>
        <Spacer modifiers={[height(4)]} />
        <Text color={fg} style={{ fontSize: props.state === 'soon' ? 28 : 18, fontWeight: 'bold' }}>{headline}</Text>
      </Column>
      <Text color={fg} style={{ fontSize: 13 }}>{props.count === 1 ? '1 Check-in gemacht' : `${props.count} Check-ins gemacht`}</Text>
    </Column>
  );
};

export default createWidget('CheckInWidget', CheckInWidget, {
  state: 'none', inDays: 0, count: 0, routineId: '', accent: '#BD9553', accentDeep: '#7B6136', onAccent: '#111111',
});
