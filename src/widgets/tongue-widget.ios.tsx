// The tongue widget on the iPhone (owner 10.11.2026, "Zungen-Erinnerung"): a small tongue that asks "Wo ist deine Zunge gerade?" every time the member looks
// at the phone. Lock screen: round, rectangular and a line above the clock; home screen: small, on the light pink of all widgets. A tap opens the setting of
// the reminder in the profile (pink since 11.11.2026). Runs in the widget's own runtime, so everything it uses stands inside the function (see the `widget` directive of
// expo-widgets); it only knows TongueWidgetProps. In tinted modes the system paints everything in one colour: nothing relies on a filled background.
import { AccessoryWidgetBackground, HStack, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, minimumScaleFactor, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TongueWidgetProps } from './props';

const TongueWidget = (props: TongueWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily;
  const tinted = environment.widgetRenderingMode === 'accented' || environment.widgetRenderingMode === 'vibrant';
  // the light pink of all widgets (owner 11.11.2026: #FFE2F0) with dark writing; tinted modes need it light
  const ink = tinted ? '#FFFFFF' : '#3A1F2B';
  const root = [containerBackground('#FFE2F0', 'widget'), widgetURL('members://profil/zunge')];

  // ---------- lock screen ----------
  if (family === 'accessoryInline') {
    return <Text modifiers={root}>👅 Wo ist deine Zunge?</Text>;
  }
  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={root}>
        <AccessoryWidgetBackground />
        <Text modifiers={[font({ size: 30 })]}>👅</Text>
      </ZStack>
    );
  }
  if (family === 'accessoryRectangular') {
    return (
      <HStack spacing={8} modifiers={root}>
        <Text modifiers={[font({ size: 30 })]}>👅</Text>
        <VStack alignment="leading" spacing={0}>
          <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>Kurz nachspüren</Text>
          <Text modifiers={[font({ size: 16, weight: 'bold', design: 'rounded' }), lineLimit(2), minimumScaleFactor(0.8)]}>Wo ist deine Zunge gerade?</Text>
        </VStack>
        <Spacer />
      </HStack>
    );
  }

  // ---------- home screen ----------
  return (
    <VStack alignment="leading" spacing={4} modifiers={root}>
      <Text modifiers={[font({ size: 40 })]}>👅</Text>
      <Spacer />
      <Text modifiers={[font({ size: 12, weight: 'bold', design: 'rounded' }), foregroundStyle(tinted ? ink : props.accentDeep), lineLimit(1)]}>KURZ NACHSPÜREN</Text>
      <Text modifiers={[font({ size: 19, weight: 'heavy', design: 'rounded' }), foregroundStyle(ink), minimumScaleFactor(0.7), lineLimit(3)]}>Wo ist deine Zunge gerade?</Text>
    </VStack>
  );
};

export default createWidget('TongueWidget', TongueWidget, { accent: '#BD9553', accentDeep: '#7B6136', onAccent: '#111111' });
