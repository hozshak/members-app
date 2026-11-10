// Stage 3: the member area with the native tab bar of the phone (iOS tab bar / Android navigation bar): Start, Inhalte
// (everything unlocked, as a library), Routine (daily routine with timer, progress photos — app only) and Profil. Each tab has its
// own stack, so headers and "back" work inside it. On top the assistant (components/tour.tsx).
// 10.11.2026: "Gruppe" between Inhalte and Profil, only where the community has the group (with the unread messages as a badge).
import { NativeTabs } from 'expo-router/native-tabs';
import { useEffect } from 'react';
import { TourOverlay } from '@/components/tour';
import { useGroupInfo } from '@/lib/group';
import { setGroupTab } from '@/lib/tour';
import { useReminderSync } from '@/lib/plans';
import { useReminderActions } from '@/lib/routine';
import { usePalette } from '@/lib/theme';
import { useRoutineWidgetSync } from '@/lib/widget-sync';

export default function TabsLayout() {
  const p = usePalette();
  useRoutineWidgetSync();
  useReminderSync();
  useReminderActions();
  // "Gruppe" (10.11.2026): a tab where the community has it switched on, with the unread messages on it
  const group = useGroupInfo(60_000);
  const showGroup = !!group.data;
  useEffect(() => { setGroupTab(showGroup); }, [showGroup]);
  return (
    <>
    <NativeTabs tintColor={p.accent} backgroundColor={p.surface} labelStyle={{ selected: { color: p.accent } }}>
      <NativeTabs.Trigger name="(start)">
        <NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="routine">
        <NativeTabs.Trigger.Label>Routine</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="inhalte">
        <NativeTabs.Trigger.Label>Inhalte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack', selected: 'square.stack.fill' }} md="video_library" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="gruppe" hidden={!showGroup}>
        <NativeTabs.Trigger.Label>{group.data?.name ?? 'Gruppe'}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="forum" />
        {group.data && group.data.access === 'open' && group.data.unread > 0 ? <NativeTabs.Trigger.Badge>{String(group.data.unread)}</NativeTabs.Trigger.Badge> : null}
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
