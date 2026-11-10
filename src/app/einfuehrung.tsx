// The introduction of a programme (lib/intro.ts), one thing per page: where the member stands, what to start with (the categories lead straight there), the coach's pages
// (e.g. the group, the tools, staying with it) and the closing words. Closing it at any time is fine: it stays reachable on the page of the programme.
// 09.11.2026 (owner: it replaces an intro video, "so richtig gut verknüpft"): the coach's pictures and tips in the text (components/intro-text.tsx); a page can end
// with a button to the programme's plan, the before photo of that plan (the camera opens above the introduction, back on the same page afterwards), a
// category of the programme or a website. Leaving for the plan or a category keeps the page: the introduction opens there again. "Los geht’s" on the last
// page leads to the programme's plan while it is not started.
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryTile } from '@/components/content';
import { IntroText } from '@/components/intro-text';
import { LinkedText } from '@/components/linked-text';
import { openPlan } from '@/components/routine-parts';
import { Button, Cover, ErrorView, Loading, Screen, Txt } from '@/components/ui';
import { uniqueById } from '@/lib/format';
import { setIntroState, useIntroState, useIntrosLoaded, type ProgrammeIntro, type ProgrammeIntroLink, type ProgrammeIntroPage } from '@/lib/intro';
import { introBlocks } from '@/lib/intro-text';
import { useOpenLink } from '@/lib/links';
import { planOfProgramme, planState, usePlanPhotos, waitingFor } from '@/lib/plans';
import { useProduct } from '@/lib/queries';
import { useRoutines } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';
import type { MemberProductDetail } from '@/lib/types';

type Page = { kind: 'where' } | { kind: 'start' } | { kind: 'page'; page: ProgrammeIntroPage } | { kind: 'closing' };

const LINK_ICONS: Record<ProgrammeIntroLink['kind'], keyof typeof Ionicons.glyphMap> = {
  plan: 'calendar-outline',
  photo: 'camera-outline',
  category: 'albums-outline',
  url: 'open-outline',
};

/** The button at the end of a page, as a card of its own: what it leads to, one tap. */
function LinkCard({ link, onPress, done }: { link: ProgrammeIntroLink; onPress: () => void; done?: { text: string; again: string } }) {
  const p = usePalette();
  if (done) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.l, backgroundColor: p.surfaceAlt }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={22} color={p.onAccent} />
        </View>
        <Txt variant="heading" style={{ flex: 1 }}>{done.text}</Txt>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onPress}>
          <Txt variant="small" color={p.accent} style={{ fontWeight: '700' }}>{done.again}</Txt>
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={link.label}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, padding: space.m, borderRadius: radius.l, borderWidth: 2, borderColor: p.accent, backgroundColor: p.accentSoft, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={LINK_ICONS[link.kind]} size={20} color={p.onAccent} />
      </View>
      <Txt variant="heading" color={p.accent} style={{ flex: 1 }}>{link.label}</Txt>
      <Ionicons name={link.kind === 'url' ? 'open-outline' : 'chevron-forward'} size={20} color={p.accent} />
    </Pressable>
  );
}

function Pager({ product, intro, base }: { product: MemberProductDetail; intro: ProgrammeIntro; base: string }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const saved = useIntroState(product.id);
  const routines = useRoutines();
  const openLink = useOpenLink();
  const plan = planOfProgramme(routines.data, product.id);
  const photos = usePlanPhotos(plan?.id ?? '');
  const level = saved.level === null ? null : intro.levels[saved.level] ?? null;
  const pages: Page[] = [
    { kind: 'where' },
    ...(level ? [{ kind: 'start' } as const] : []),
    ...intro.pages.map((x) => ({ kind: 'page' as const, page: x })),
    ...(intro.closing ? [{ kind: 'closing' } as const] : []),
  ];
  // where the member left it (for the plan or a category), until it is finished
  const [index, setIndex] = useState(() => (saved.finished ? 0 : Math.min(saved.page ?? 0, pages.length - 1)));
  const page = pages[index] ?? { kind: 'where' as const };
  const isLast = index >= pages.length - 1;
  const categories = uniqueById(product.categories);
  const startWith = level ? level.categoryIds.flatMap((id) => categories.filter((c) => c.id === id)) : [];
  const leadImages = intro.leadImages ?? [];
  const leadHasPicture = introBlocks(intro.lead, leadImages).some((b) => b.kind === 'image');
  // "Los geht’s" leads into the plan while it can be started
  const planNext = plan && planState(plan) === 'open' && !plan.skipped && !waitingFor(routines.data, plan) ? plan : null;

  useEffect(() => {
    setIntroState(product.id, { seen: true });
  }, [product.id]);

  const go = (i: number) => {
    setIndex(i);
    setIntroState(product.id, { page: i });
  };
  const close = () => router.back();
  const finish = () => {
    setIntroState(product.id, { finished: true, page: 0 });
    router.back();
    if (planNext) openPlan(planNext.id);
  };
  const openCategory = (slug: string) => {
    setIntroState(product.id, { finished: true });
    router.back();
    router.push(`${base}/kategorie/${encodeURIComponent(slug)}` as Href);
  };
  /** The introduction closes for the plan or a category; it opens on this page again. */
  const leave = (then: () => void) => {
    setIntroState(product.id, { page: index });
    router.back();
    then();
  };
  const linkOf = (link: ProgrammeIntroLink | null | undefined): { link: ProgrammeIntroLink; onPress: () => void; done?: { text: string; again: string } } | null => {
    if (!link) return null;
    if (link.kind === 'plan') return plan ? { link, onPress: () => leave(() => openPlan(plan.id)) } : null;
    if (link.kind === 'photo') {
      const take = () => router.push({ pathname: '/foto', params: plan ? { plan: plan.id, slot: 'start' } : {} } as unknown as Href);
      return { link, onPress: take, done: plan && photos.start ? { text: 'Dein Vorher-Foto ist gemacht', again: 'Neu machen' } : undefined };
    }
    if (link.kind === 'category') {
      const c = categories.find((x) => x.id === link.target);
      return c ? { link, onPress: () => leave(() => router.push(`${base}/kategorie/${encodeURIComponent(c.slug)}` as Href)) } : null;
    }
    return link.target ? { link, onPress: () => openLink(link.target) } : null;
  };
  const button = page.kind === 'page' ? linkOf(page.page.link) : null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Screen contentStyle={{ paddingTop: insets.top + space.m, gap: space.l, paddingBottom: 130 + insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          {index > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Zurück" hitSlop={12} onPress={() => go(index - 1)}>
              <Ionicons name="chevron-back" size={28} color={p.text} />
            </Pressable>
          ) : null}
          <View accessibilityLabel={`Schritt ${index + 1} von ${pages.length}`} style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
            {pages.map((_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= index ? p.accent : p.surfaceAlt }} />)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={12} onPress={close}>
            <Ionicons name="close" size={28} color={p.text} />
          </Pressable>
        </View>

        {page.kind === 'where' ? (
          <>
            {leadHasPicture ? null : <Cover url={product.imageUrl} title={product.title} />}
            <View style={{ gap: space.s }}>
              <Txt variant="caption" color={p.accent}>{product.title}</Txt>
              <Txt variant="display">{intro.title}</Txt>
            </View>
            {intro.lead ? <IntroText text={intro.lead} images={leadImages} /> : null}
            {intro.levels.length > 0 ? (
              <View style={{ gap: space.m }}>
                <Txt variant="title">{intro.question}</Txt>
                <View accessibilityRole="radiogroup" style={{ gap: space.s }}>
                  {intro.levels.map((l, i) => {
                    const on = saved.level === i;
                    return (
                      <Pressable
                        key={l.label}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={l.hint ? `${l.label}, ${l.hint}` : l.label}
                        onPress={() => {
                          setIntroState(product.id, { level: i });
                          go(1);
                        }}
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 72, padding: space.m, borderRadius: radius.l, borderWidth: 2, borderColor: on ? p.accent : p.line, backgroundColor: on ? p.accentSoft : p.surface, opacity: pressed ? 0.85 : 1 })}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Txt variant="heading">{l.label}</Txt>
                          {l.hint ? <Txt variant="small" muted>{l.hint}</Txt> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={on ? p.accent : p.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {page.kind === 'start' && level ? (
          <>
            <View style={{ gap: space.s }}>
              <Txt variant="caption" color={p.accent}>Dein Start</Txt>
              <Txt variant="display">{level.label}</Txt>
              <IntroText text={level.text} />
            </View>
            {startWith.length > 0 ? (
              <View style={{ gap: space.m }}>
                <Txt variant="title">Damit fängst du an</Txt>
                {startWith.map((c) => <CategoryTile key={c.id} category={c} onOpen={() => openCategory(c.slug)} />)}
              </View>
            ) : null}
          </>
        ) : null}

        {page.kind === 'page' ? (
          <>
            <View style={{ gap: space.s }}>
              <Txt variant="caption" color={p.accent}>{intro.title}</Txt>
              <Txt variant="display">{page.page.title}</Txt>
            </View>
            <IntroText text={page.page.text} images={page.page.images ?? []} />
            {button ? <LinkCard {...button} /> : null}
          </>
        ) : null}

        {page.kind === 'closing' ? (
          <View style={{ alignItems: 'center', gap: space.m, paddingTop: space.xl }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="heart" size={44} color={p.accent} />
            </View>
            <LinkedText text={intro.closing} rich variant="title" style={{ textAlign: 'center' }} />
            {planNext ? <Txt muted style={{ textAlign: 'center' }}>Als Nächstes: „{planNext.title}“</Txt> : null}
          </View>
        ) : null}
      </Screen>

      {page.kind !== 'where' || intro.levels.length === 0 ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.m, backgroundColor: p.bg, borderTopColor: p.line }]}>
          <Button label={isLast ? 'Los geht’s' : 'Weiter'} onPress={isLast ? finish : () => go(index + 1)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, paddingTop: space.m, borderTopWidth: StyleSheet.hairlineWidth },
});

export default function IntroScreen() {
  const { slug, base } = useLocalSearchParams<{ slug: string; base?: string }>();
  const q = useProduct(slug);
  // the page the member left it on is on the phone: the pager starts once that is read
  const loaded = useIntrosLoaded();
  if (q.isPending || !loaded) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data.intro) return <ErrorView error={new Error('not_found')} onRetry={() => router.back()} />;
  return <Pager product={q.data} intro={q.data.intro} base={base ?? ''} />;
}
