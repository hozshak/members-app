// The offer page of the group (owner 10.11.2026: "monatlich 4,99 €, jährlich 49 €, also 10 € sparen; eine Option für 7 Tage testen"): what the group
// gives (the coach's text), the two plans with the store's own prices (the year with what it saves), a free trial when the store offers one for this
// member, "Käufe wiederherstellen", and what Apple asks of a subscription page: renewal, how to cancel, terms and privacy (Guideline 3.1.2).
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Screen, Txt } from '@/components/ui';
import type { GroupInfo } from '@/lib/group';
import { useGroupStore, type PlanKind, type StorePlan } from '@/lib/group-store';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

const APPLE_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** An amount in the store's own currency (App Review 13.11.2026: never "€" next to a price in dollars or francs); null when the store did not say. */
const money = (n: number, currency: string | null): string | null => {
  if (!currency) return null;
  try {
    return n.toLocaleString('de-DE', { style: 'currency', currency });
  } catch {
    return null;
  }
};

function PlanCard({ plan, selected, saves, onPress }: { plan: StorePlan; selected: boolean; saves: string | null; onPress: () => void }) {
  const p = usePalette();
  const yearly = plan.kind === 'yearly';
  const perMonth = yearly && plan.amount ? money(plan.amount / 12, plan.currency) : null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, padding: space.l, gap: space.xs, borderRadius: radius.l, borderWidth: 2, borderColor: selected ? p.accent : p.line,
        backgroundColor: selected ? p.accentSoft : p.surface, opacity: pressed ? 0.85 : 1,
      })}
    >
      {saves ? (
        <View style={{ position: 'absolute', top: -12, right: space.m, paddingHorizontal: space.s, paddingVertical: 2, borderRadius: 999, backgroundColor: p.accent }}>
          <Txt variant="small" color={p.onAccent} style={{ fontWeight: '700' }}>{saves}</Txt>
        </View>
      ) : null}
      <Txt variant="caption" color={selected ? p.accent : p.textMuted}>{yearly ? 'Jährlich' : 'Monatlich'}</Txt>
      <Txt variant="title">{plan.price}</Txt>
      <Txt variant="small" muted>
        {yearly ? (perMonth ? `nur ${perMonth} im Monat` : 'im Jahr') : 'im Monat'}
      </Txt>
    </Pressable>
  );
}

export function GroupPaywall({ info }: { info: GroupInfo }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { community } = useSession();
  const store = useGroupStore(info);
  const [kind, setKind] = useState<PlanKind>('yearly');
  const plan = store.plans.find((x) => x.kind === kind) ?? store.plans[0];
  const monthly = store.plans.find((x) => x.kind === 'monthly');
  const yearly = store.plans.find((x) => x.kind === 'yearly');
  // the saving only when both prices are in the same currency, and written in that currency
  const saving = monthly?.amount && yearly?.amount && monthly.currency && monthly.currency === yearly.currency ? monthly.amount * 12 - yearly.amount : 0;
  const savingText = saving > 0.5 && yearly ? money(saving, yearly.currency) : null;
  const storeName = Platform.OS === 'ios' ? 'Apple-Account' : 'Google-Play-Konto';
  const [restored, setRestored] = useState<boolean | null>(null);

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.l, gap: space.xl, paddingBottom: insets.bottom + space.xxl * 2 }}>
      <View style={{ gap: space.m, alignItems: 'center', paddingTop: space.l }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accentSoft }}>
          <Ionicons name="chatbubbles" size={34} color={p.accent} />
        </View>
        <Txt variant="display" style={{ textAlign: 'center' }}>{info.name}</Txt>
        {info.pitch ? <Txt muted style={{ textAlign: 'center' }}>{info.pitch}</Txt> : null}
      </View>

      <View style={{ gap: space.s }}>
        {[
          { icon: 'people-outline' as const, text: 'Austausch mit anderen, die denselben Weg gehen' },
          { icon: 'sparkles-outline' as const, text: `Impulse, Bilder und Umfragen von ${community?.name ?? 'deinem Coach'}` },
          { icon: 'calendar-outline' as const, text: 'Jederzeit kündbar' },
        ].map((x) => (
          <View key={x.text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
            <Ionicons name={x.icon} size={20} color={p.accent} />
            <Txt style={{ flex: 1 }}>{x.text}</Txt>
          </View>
        ))}
      </View>

      {store.status === 'ready' && plan ? (
        <View style={{ gap: space.l }}>
          <View style={{ flexDirection: 'row', gap: space.m, paddingTop: space.s }}>
            {monthly ? <PlanCard plan={monthly} selected={plan.kind === 'monthly'} saves={null} onPress={() => setKind('monthly')} /> : null}
            {yearly ? <PlanCard plan={yearly} selected={plan.kind === 'yearly'} saves={savingText ? `Spare ${savingText}` : null} onPress={() => setKind('yearly')} /> : null}
          </View>
          <Button
            label={plan.trialDays ? `${plan.trialDays} Tage kostenlos testen` : 'Jetzt dabei sein'}
            onPress={() => void store.buy(plan)}
            loading={store.busy}
          />
          {plan.trialDays ? <Txt variant="small" muted style={{ textAlign: 'center' }}>Danach {plan.price} {plan.kind === 'yearly' ? 'im Jahr' : 'im Monat'}. Kündigst du vorher, zahlst du nichts.</Txt> : null}
        </View>
      ) : store.status === 'loading' ? (
        <Button label="Preise werden geladen" onPress={() => undefined} loading />
      ) : (
        <View style={{ padding: space.l, borderRadius: radius.l, backgroundColor: p.surface, gap: space.xs }}>
          <Txt variant="heading">{store.status === 'off' ? 'Nur in der App' : 'Gleich startklar'}</Txt>
          <Txt muted>
            {store.status === 'off'
              ? 'Das Abo schließt du in der App aus dem App Store oder von Google Play ab.'
              : 'Das Abo wird gerade eingerichtet. Schau bald wieder vorbei.'}
          </Txt>
        </View>
      )}
      {store.error ? <Txt color={p.danger} style={{ textAlign: 'center' }}>{store.error}</Txt> : null}

      {store.status === 'ready' || store.status === 'unavailable' ? (
        <Pressable accessibilityRole="button" onPress={() => void store.restore().then(setRestored)} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
          <Txt color={p.accent}>Käufe wiederherstellen</Txt>
        </Pressable>
      ) : null}
      {restored === false ? <Txt variant="small" muted style={{ textAlign: 'center' }}>Kein laufendes Abo gefunden.</Txt> : null}

      <View style={{ gap: space.s }}>
        <Txt variant="small" muted>
          Das Abo verlängert sich automatisch zum angezeigten Preis, wenn du es nicht mindestens 24 Stunden vor Ende des Zeitraums kündigst. Bezahlt und
          verwaltet wird es über dein {storeName}; kündigen kannst du dort jederzeit in den Abo-Einstellungen.
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.l }}>
          {Platform.OS === 'ios' ? (
            <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(APPLE_EULA)}><Txt variant="small" color={p.accent}>Nutzungsbedingungen</Txt></Pressable>
          ) : community ? (
            <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/rechtliches/agb`)}><Txt variant="small" color={p.accent}>AGB</Txt></Pressable>
          ) : null}
          {community ? (
            <Pressable accessibilityRole="link" onPress={() => void WebBrowser.openBrowserAsync(`${community.url}/rechtliches/datenschutz`)}><Txt variant="small" color={p.accent}>Datenschutz</Txt></Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
