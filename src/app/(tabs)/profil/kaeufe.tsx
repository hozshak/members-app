// What the member bought: product, date, state and how long the access runs. Prices, invoices, cancellations and
// withdrawals stay on the website (the app sells nothing and handles no payments).
import { View } from 'react-native';
import { Badge, Card, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { usePurchases } from '@/lib/queries';
import { space } from '@/lib/theme';
import type { Purchase } from '@/lib/types';

const day = (sec: number) => new Date(sec * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

function state(pu: Purchase): { label: string; tone: 'success' | 'neutral' | 'accent' } {
  if (pu.accessLocked) return { label: 'Gesperrt', tone: 'accent' };
  if (pu.paidAt) return { label: 'Bezahlt', tone: 'success' };
  if (pu.status === 'cancelled' || pu.status === 'refunded') return { label: 'Storniert', tone: 'neutral' };
  return { label: 'Offen', tone: 'accent' };
}

export default function PurchasesScreen() {
  const q = usePurchases();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const items = q.data.filter((pu) => !pu.isTest);

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {items.length === 0 ? <Txt muted>Du hast noch nichts gekauft.</Txt> : null}
      <View style={{ gap: space.s }}>
        {items.map((pu) => {
          const st = state(pu);
          return (
            <Card key={pu.orderId} style={{ padding: space.l, gap: space.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                <Txt variant="heading" style={{ flex: 1 }}>{pu.productTitle}</Txt>
                <Badge label={st.label} tone={st.tone} />
              </View>
              <Txt variant="small" muted>Gekauft am {day(pu.createdAt)} · Nr. {pu.number}</Txt>
              {pu.accessUntil ? <Txt variant="small" muted>Zugang bis {day(pu.accessUntil)}</Txt> : null}
            </Card>
          );
        })}
      </View>
      <Txt variant="small" muted>Rechnungen, Kündigung und Widerruf findest du auf der Website unter „Meine Käufe“.</Txt>
    </Screen>
  );
}
