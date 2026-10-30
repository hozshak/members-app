// "Mein Ziel": what the member wants to reach (own words or an example), how often per week and for how long. It shows
// how many routine days that are and until when; saving starts the goal today. The goal can be changed or removed.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { Button, Field, Screen, Txt } from '@/components/ui';
import { addDays, GOAL_DAYS, GOAL_EXAMPLES, GOAL_PER_WEEK, useGoal } from '@/lib/goal';
import { localDay } from '@/lib/nav';
import { radius, space, usePalette } from '@/lib/theme';

function Chips<T extends string | number>({ items, value, label, onChange }: { items: T[]; value: T | null; label: (v: T) => string; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
      {items.map((it) => {
        const on = it === value;
        return (
          <Pressable
            key={String(it)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(it)}
            style={{ paddingHorizontal: space.l, paddingVertical: space.s, minHeight: 44, justifyContent: 'center', borderRadius: 999, backgroundColor: on ? p.accent : p.surface, borderWidth: 1, borderColor: on ? p.accent : p.line }}
          >
            <Txt variant="heading" color={on ? p.onAccent : p.text}>{label(it)}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function GoalScreen() {
  const p = usePalette();
  const [goal, setGoal] = useGoal();
  const [text, setText] = useState(goal?.text ?? '');
  const [perWeek, setPerWeek] = useState(goal?.perWeek ?? 5);
  const [days, setDays] = useState(goal?.days ?? 30);
  const target = Math.ceil((days * perWeek) / 7);
  const end = new Date(`${addDays(localDay(), days - 1)}T12:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

  const save = () => {
    // a changed goal keeps its start; a new one starts today
    setGoal({ text: text.trim(), perWeek, days, startDay: goal?.startDay ?? localDay() });
    router.back();
  };
  const remove = () => Alert.alert('Ziel entfernen?', undefined, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: 'Entfernen', style: 'destructive', onPress: () => { setGoal(null); router.back(); } },
  ]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <View style={{ gap: space.s }}>
          <Txt variant="title">Was willst du erreichen?</Txt>
          <Field label="Mein Ziel" value={text} onChangeText={setText} placeholder="z. B. Straffere Kinnpartie" maxLength={80} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
            {GOAL_EXAMPLES.map((ex) => (
              <Pressable key={ex} accessibilityRole="button" onPress={() => setText(ex)} style={{ paddingHorizontal: space.m, paddingVertical: 6, borderRadius: 999, backgroundColor: p.accentSoft }}>
                <Txt variant="small" color={p.accent}>{ex}</Txt>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: space.s }}>
          <Txt variant="heading">Wie oft pro Woche?</Txt>
          <Chips items={GOAL_PER_WEEK} value={perWeek} label={(n) => `${n}×`} onChange={setPerWeek} />
        </View>

        <View style={{ gap: space.s }}>
          <Txt variant="heading">Wie lange?</Txt>
          <Chips items={GOAL_DAYS} value={days} label={(n) => `${n} Tage`} onChange={setDays} />
        </View>

        <View style={{ padding: space.l, borderRadius: radius.l, backgroundColor: p.accentSoft, gap: 4 }}>
          <Txt variant="heading">{target} Routine-Tage {goal ? 'insgesamt' : `bis zum ${end}`}</Txt>
          <Txt variant="small" muted>Ein Balken zeigt dir jeden Tag, wie nah du deinem Ziel bist.</Txt>
        </View>

        <Button label={goal ? 'Ziel speichern' : 'Ziel starten'} onPress={save} disabled={!text.trim()} />
        {goal ? <Button label="Ziel entfernen" kind="ghost" onPress={remove} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
