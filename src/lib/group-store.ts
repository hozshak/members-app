// The subscription of the group bought in the app (owner 10.11.2026: "monatlich 4,99 €, jährlich 49 €, die Bezahlung geht über Apple/Google in der App"):
// the prices of the store, the purchase (it carries the member's token, so the server gives it to this member only), and the server's check before the
// store is told the purchase is done. "Käufe wiederherstellen" sends what the store still has to the server again. Apple: two products (month, year);
// Google: one subscription with the base plans "monat" and "jahr". Only in a build of the app with the store module (not in Expo Go, not in the browser).
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { errorText } from './api';
import { groupKey, type GroupInfo } from './group';
import { useApi } from './session';

type Iap = typeof import('expo-iap');

const available = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
let iapModule: Iap | null | undefined;

function iap(): Iap | null {
  if (!available) return null;
  if (iapModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not load where the native module is missing (Expo Go, browser)
      iapModule = require('expo-iap') as Iap;
    } catch {
      iapModule = null;
    }
  }
  return iapModule;
}

export type PlanKind = 'monthly' | 'yearly';
export interface StorePlan { kind: PlanKind; price: string; amount: number | null; trialDays: number | null; sku: string; offerToken?: string }

const GOOGLE_BASE_PLANS: Record<PlanKind, string> = { monthly: 'monat', yearly: 'jahr' };

/** "P1W" / free-trial periods → days. */
function trialDaysOf(unit: string | null | undefined, count: number | null | undefined): number | null {
  if (!unit || !count) return null;
  const u = unit.toLowerCase();
  return u.startsWith('day') ? count : u.startsWith('week') ? count * 7 : u.startsWith('month') ? count * 30 : null;
}

/**
 * The store for the group: its plans with the store's own prices, buying, restoring. `status`: 'off' (no store module here), 'loading', 'ready',
 * 'unavailable' (the products are not (yet) in the store).
 */
export function useGroupStore(info: GroupInfo | null | undefined) {
  const api = useApi();
  const qc = useQueryClient();
  const mod = iap();
  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [status, setStatus] = useState<'off' | 'loading' | 'ready' | 'unavailable'>(mod ? 'loading' : 'off');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const products = info?.products;
  const appleSkus = products ? [products.apple.monthly, products.apple.yearly].filter(Boolean) : [];
  const googleSku = products?.google.productId ?? '';
  const skuKey = Platform.OS === 'ios' ? appleSkus.join(',') : googleSku;
  // the server's check of one purchase, then the store is told it is done
  const settle = useRef<(p: import('expo-iap').Purchase) => Promise<boolean>>(async () => false);
  useEffect(() => {
  settle.current = async (purchase) => {
    const m = iap();
    if (!m) return false;
    try {
      const next = Platform.OS === 'ios'
        ? await api.post<GroupInfo>('/api/member/group/purchases/apple', { transactionId: purchase.id })
        : await api.post<GroupInfo>('/api/member/group/purchases/google', { purchaseToken: purchase.purchaseToken ?? '', productId: purchase.productId });
      qc.setQueryData(groupKey, next);
      await m.finishTransaction({ purchase, isConsumable: false });
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    }
  };
  });

  useEffect(() => {
    const m = mod;
    if (!m || !skuKey) return undefined;
    let alive = true;
    const subs: { remove(): void }[] = [];
    void (async () => {
      try {
        await m.initConnection();
        subs.push(m.purchaseUpdatedListener((p) => {
          void settle.current(p).finally(() => { if (alive) setBusy(false); });
        }));
        subs.push(m.purchaseErrorListener((e) => {
          if (!alive) return;
          setBusy(false);
          // the member closed the store's sheet: no message
          if (String(e.code).toLowerCase().includes('cancel')) return;
          setError(e.message || 'Der Kauf hat nicht geklappt.');
        }));
        const found = await m.fetchProducts({ skus: skuKey.split(','), type: 'subs' });
        if (!alive) return;
        const list = (found ?? []) as unknown as Record<string, unknown>[];
        const next: StorePlan[] = [];
        if (Platform.OS === 'ios') {
          for (const kind of ['monthly', 'yearly'] as const) {
            const sku = kind === 'monthly' ? products?.apple.monthly : products?.apple.yearly;
            const p = list.find((x) => x.id === sku);
            if (!p || !sku) continue;
            const free = String(p.introductoryPricePaymentModeIOS ?? '').toLowerCase().includes('free');
            const period = p.introductoryPriceSubscriptionPeriodIOS as string | null | undefined;
            next.push({
              kind, sku, price: String(p.displayPrice ?? ''), amount: typeof p.price === 'number' ? p.price : null,
              trialDays: free ? trialDaysOf(period, Number(p.introductoryPriceNumberOfPeriodsIOS ?? 1)) : null,
            });
          }
        } else {
          const p = list.find((x) => x.id === googleSku);
          const offers = (p?.subscriptionOffers ?? []) as Record<string, unknown>[];
          for (const kind of ['monthly', 'yearly'] as const) {
            const base = offers.filter((o) => o.basePlanIdAndroid === GOOGLE_BASE_PLANS[kind]);
            // a free trial offer of the base plan first, else the base plan itself
            const trial = base.find((o) => o.paymentMode === 'free-trial' || (typeof o.price === 'number' && o.price === 0 && o.id !== GOOGLE_BASE_PLANS[kind]));
            const plain = base.find((o) => !o.offerTagsAndroid || (o.offerTagsAndroid as string[]).length === 0) ?? base[0];
            const pick = trial ?? plain;
            if (!pick || !plain) continue;
            const period = pick.period as { unit?: string; value?: number } | null | undefined;
            next.push({
              kind, sku: googleSku, price: String(plain.displayPrice ?? ''), amount: typeof plain.price === 'number' ? plain.price : null,
              trialDays: trial ? trialDaysOf(period?.unit, period?.value ?? 1) : null, offerToken: String(pick.offerTokenAndroid ?? ''),
            });
          }
        }
        setPlans(next);
        setStatus(next.length > 0 ? 'ready' : 'unavailable');
      } catch {
        if (alive) setStatus('unavailable');
      }
    })();
    return () => {
      alive = false;
      subs.forEach((s) => s.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the products are named by `skuKey`
  }, [mod, skuKey]);

  const buy = useCallback(async (plan: StorePlan) => {
    const m = iap();
    if (!m || !info) return;
    setError(null);
    setBusy(true);
    try {
      await m.requestPurchase({
        type: 'subs',
        request: Platform.OS === 'ios'
          ? { apple: { sku: plan.sku, appAccountToken: info.purchaseToken } }
          : { google: { skus: [plan.sku], obfuscatedAccountId: info.purchaseToken, subscriptionOffers: plan.offerToken ? [{ sku: plan.sku, offerToken: plan.offerToken }] : [] } },
      });
    } catch (err) {
      setBusy(false);
      setError(errorText(err));
    }
  }, [info]);

  /** "Käufe wiederherstellen": what the store still has goes to the server again. */
  const restore = useCallback(async (): Promise<boolean> => {
    const m = iap();
    if (!m) return false;
    setError(null);
    setBusy(true);
    try {
      const purchases = await m.getAvailablePurchases();
      let ok = false;
      for (const p of purchases ?? []) ok = (await settle.current(p)) || ok;
      return ok;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, plans, buy, restore, busy, error };
}
