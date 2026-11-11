// The tongue widget on Android (owner 10.11.2026): the small tongue and the question, on the light pink of all widgets. Android phones have no widgets on the lock
// screen, so this one is for the home screen. Runs in the widget's own runtime, so everything it uses stands inside the function.
import { Column, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, height, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TongueWidgetProps } from './props';

const TongueWidget = (props: TongueWidgetProps, _environment: WidgetEnvironment) => {
  'widget';
  // the light pink of all widgets (owner 11.11.2026: #FFE2F0) with dark writing
  return (
    <Column modifiers={[fillMaxSize(), cornerRadius(24), background('#FFE2F0'), paddingAll(16)]} verticalArrangement="spaceBetween">
      <Text style={{ fontSize: 34 }}>👅</Text>
      <Column>
        <Text color={props.accentDeep} style={{ fontSize: 12, fontWeight: 'bold' }}>KURZ NACHSPÜREN</Text>
        <Spacer modifiers={[height(4)]} />
        <Text color="#3A1F2B" style={{ fontSize: 18, fontWeight: 'bold' }}>Wo ist deine Zunge gerade?</Text>
      </Column>
    </Column>
  );
};

export default createWidget('TongueWidget', TongueWidget, { accent: '#BD9553', accentDeep: '#7B6136', onAccent: '#111111' });
