// Stage 3: the member area with the native tab bar of the phone (iOS tab bar / Android navigation bar): Start, Inhalte
// (everything unlocked, as a library), Routine (daily routine with timer, progress photos — app only) and Profil. Each tab has its
// own stack, so headers and "back" work inside it. On top the assistant (components/tour.tsx).
import { NativeTabs } from 'expo-router/native-tabs';
import { TourOverlay } from '@/components/tour';
import { useReminderSync } from '@/lib/plans';
import { useReminderActions } from '@/lib/routine';
import { usePalette } from '@/lib/theme';
import { useRoutineWidgetSync } from '@/lib/widget-sync';

export default function TabsLayout() {
  const p = usePalette();
  useRoutineWidgetSync();
  useReminderSync();
  useReminderActions();
  return (
    <>
    <NativeTabs tintColor={p.accent} backgroundColor={p.surface} labelStyle={{ selected: { color: p.accent } }}>
      <NativeTabs.Trigger name="(start)">
        <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inhalte">
        <NativeTabs.Trigger.Label>Inhalte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack', selected: 'square.stack.fill' }} md="video_library" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="routine">
        <NativeTabs.Trigger.Label>Routine</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>Profil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
    <TourOverlay />
    </>
  );
}
