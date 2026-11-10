// The "Gruppe" tab (owner 10.11.2026: "Gruppe … da können die Mitglieder miteinander sprechen"): without a subscription the offer page; once in, the rules
// to accept before the first message; then the chat. A banned member reads a short note; a group switched off shows nothing to do here.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GroupChat } from '@/components/group/chat';
import { GroupPaywall } from '@/components/group/paywall';
import { Button, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useGroupActions, useGroupInfo, type GroupInfo } from '@/lib/group';
import { radius, space, usePalette } from '@/lib/theme';

function Rules({ info }: { info: GroupInfo }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const act = useGroupActions();
  const rules = info.rules.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.xl, gap: space.xl }}>
      <View style={{ gap: space.s }}>
        <Txt variant="caption" color={p.accent}>Willkommen in der {info.name}</Txt>
        <Txt variant="display">Unsere Regeln</Txt>
        <Txt muted>Damit sich hier alle wohlfühlen. Bitte lies sie einmal durch.</Txt>
      </View>
      <View style={{ gap: space.m, padding: space.l, borderRadius: radius.l, backgroundColor: p.surface }}>
        {rules.map((r, i) => (
          <View key={`${i}-${r}`} style={{ flexDirection: 'row', gap: space.m, alignItems: 'flex-start' }}>
            <Ionicons name="checkmark-circle" size={20} color={p.accent} style={{ marginTop: 2 }} />
            <Txt style={{ flex: 1 }}>{r}</Txt>
          </View>
        ))}
      </View>
      <Txt variant="small" muted>Nachrichten, die gegen die Regeln verstoßen, kannst du melden: lange auf die Nachricht drücken.</Txt>
      <Button label="Verstanden, ich bin dabei" onPress={() => act.acceptRules.mutate()} loading={act.acceptRules.isPending} />
      {act.acceptRules.error ? <Txt color={p.danger}>{errorText(act.acceptRules.error)}</Txt> : null}
    </Screen>
  );
}

export default function GroupScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const q = useGroupInfo(focused ? 30_000 : undefined);
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const info = q.data;
  if (!info) {
    return <Screen contentStyle={{ paddingTop: insets.top + space.xl }}><Txt muted>Die Gruppe ist gerade nicht verfügbar.</Txt></Screen>;
  }
  if (info.access === 'banned') {
    return (
      <Screen contentStyle={{ paddingTop: insets.top + space.xxl, alignItems: 'center', gap: space.m }}>
        <Ionicons name="lock-closed" size={40} color={p.textMuted} />
        <Txt variant="title" style={{ textAlign: 'center' }}>Du bist nicht mehr in der Gruppe</Txt>
        <Txt muted style={{ textAlign: 'center' }}>Bei Fragen wende dich an das Team.</Txt>
      </Screen>
    );
  }
  if (info.access === 'subscribe') return <GroupPaywall info={info} />;
  if (!info.rulesAccepted) return <Rules info={info} />;
  return <GroupChat info={info} />;
}
