// The popup of a reminder: its time (the photo also its day), saved only with "Speichern". Used under "Profil → Erinnerungen" and by the
// hint in the routine.
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { clockTime, REMINDER_DAYS } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';
import { Button, Field, Txt } from './ui';

/** The time as a wheel in the popup (iPhone), behind the phone's own clock dialog (Android) or as text (browser preview). */
function TimeField({ hour, minute, onChange }: { hour: number; minute: number; onChange: (hour: number, minute: number) => void }) {
  const p = usePalette();
  const [dialog, setDialog] = useState(false);
  const [text, setText] = useState(clockTime(hour, minute).slice(0, 5));
  const asDate = new Date();
  asDate.setHours(hour, minute, 0, 0);
  if (Platform.OS === 'web') {
    return (
      <Field
        label="Uhrzeit"
        value={text}
        onChangeText={(v) => {
          setText(v);
          const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v);
          if (m) onChange(Number(m[1]), Number(m[2]));
        }}
      />
    );
  }
  const picker = (
    <DateTimePicker
      value={asDate}
      mode="time"
      is24Hour
      locale="de-DE"
      themeVariant={p.scheme}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      style={{ alignSelf: 'stretch' }}
      onChange={(event, date) => {
        setDialog(false);
        if (event.type === 'set' && date) onChange(date.getHours(), date.getMinutes());
      }}
    />
  );
  if (Platform.OS === 'ios') return picker;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Uhrzeit wählen" onPress={() => setDialog(true)} style={{ alignItems: 'center', paddingVertical: space.m, borderRadius: radius.m, backgroundColor: p.surfaceAlt }}>
        <Txt variant="display" style={{ fontVariant: ['tabular-nums'] }}>{clockTime(hour, minute)}</Txt>
      </Pressable>
      {dialog ? picker : null}
    </>
  );
}

export function ReminderPopup({ title, hint, hour, minute, weekday, onSave, onClose }: {
  title: string; hint: string; hour: number; minute: number; weekday?: number;
  onSave: (hour: number, minute: number, weekday: number | undefined) => void; onClose: () => void;
}) {
  const p = usePalette();
  const [time, setTime] = useState({ hour, minute });
  const [day, setDay] = useState(weekday);
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.l }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Schließen, ohne zu speichern" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        <View accessibilityViewIsModal style={{ gap: space.m, padding: space.xl, borderRadius: radius.xl, backgroundColor: p.surface }}>
          <View style={{ gap: 2 }}>
            <Txt variant="title">{title}</Txt>
            <Txt variant="small" muted>{hint}</Txt>
          </View>
          {day !== undefined ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
              {REMINDER_DAYS.map((w) => {
                const on = w.day === day;
                return (
                  <Pressable
                    key={w.day}
                    accessibilityRole="radio"
                    accessibilityLabel={w.long}
                    accessibilityState={{ selected: on }}
                    onPress={() => setDay(w.day)}
                    style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.m, backgroundColor: on ? p.accent : p.surfaceAlt }}
                  >
                    <Txt variant="small" color={on ? p.onAccent : p.text} style={{ fontWeight: '700' }}>{w.short}</Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <TimeField hour={time.hour} minute={time.minute} onChange={(h, m) => setTime({ hour: h, minute: m })} />
          <View style={{ flexDirection: 'row', gap: space.m }}>
            <Button label="Abbrechen" kind="secondary" onPress={onClose} style={{ flex: 1, paddingHorizontal: space.m }} />
            <Button label="Speichern" onPress={() => onSave(time.hour, time.minute, day)} style={{ flex: 1, paddingHorizontal: space.m }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
