// Stage 3: the member area with the native tab bar of the phone (iOS tab bar / Android navigation bar). Each tab has its
// own stack, so headers and "back" work inside it.
import { NativeTabs } from 'expo-router/native-tabs';
import { usePalette } from '@/lib/theme';

export default function TabsLayout() {
  const p = usePalette();
  return (
    <NativeTabs tintColor={p.accent} backgroundColor={p.surface} labelStyle={{ selected: { color: p.accent } }}>
      <NativeTabs.Trigger name="(start)">
        <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
