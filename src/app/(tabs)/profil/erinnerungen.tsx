// The reminders of the routine (local notifications of the phone): the daily one, which can be moved from the notification itself
// ("In 1 Stunde", lib/routine.ts), and the weekly photo. A switch per reminder; while it is on a tap on its time opens a popup, which
// saves only with "Speichern".
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Field, MenuGroup, Screen, ToggleRow, Txt } from '@/components/ui';
import { mainRoutine } from '@/lib/plans';
import { allowNotifications, clockTime, REMINDER_DAYS, syncReminders, useRoutinePrefs, useRoutines, type RoutinePrefs } from '@/lib/routine';
import { radius, space, usePalette } from '@/lib/theme';

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

/** The popup of a reminder: its time (the photo also its day), saved only with "Speichern". */
function ReminderPopup({ title, hint, hour, minute, weekday, onSave, onClose }: {
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

/** A reminder: the switch and, while it is on, its time; a tap on the time opens the popup. */
function ReminderRow({ label, help, timeLabel, when, value, onToggle, onEdit }: {
  label: string; help: string; timeLabel: string; when: string; value: boolean; onToggle: (v: boolean) => void; onEdit: () => void;
}) {
  const p = usePalette();
  return (
    <View style={{ backgroundColor: p.surface }}>
      <ToggleRow label={label} help={help} value={value} onValueChange={onToggle} />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${when}, ändern`}
          onPress={onEdit}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 44, paddingHorizontal: space.l, paddingBottom: space.m, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="time-outline" size={18} color={p.accent} />
          <Txt variant="small" muted style={{ flex: 1 }}>{timeLabel}</Txt>
          <Txt variant="heading" color={p.accent} style={{ fontVariant: ['tabular-nums'] }}>{when}</Txt>
          <Ionicons name="chevron-forward" size={16} color={p.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function RemindersScreen() {
  const q = useRoutines();
  const routine = mainRoutine(q.data);
  const [prefs, update] = useRoutinePrefs();
  const [editing, setEditing] = useState<'daily' | 'photo' | null>(null);

  const turnOn = async (patch: Partial<RoutinePrefs>, kind: NonNullable<typeof editing>) => {
    if (!(await allowNotifications())) {
      Alert.alert('Mitteilungen sind aus', 'Erlaube Mitteilungen für die App in den Einstellungen deines Handys, dann klappen die Erinnerungen.');
      return;
    }
    await syncReminders(update(patch), routine);
    setEditing(kind);
  };
  const off = (patch: Partial<RoutinePrefs>) => void syncReminders(update(patch), routine);
  const save = (patch: Partial<RoutinePrefs>) => {
    void syncReminders(update(patch), routine);
    setEditing(null);
  };
  const photoDay = REMINDER_DAYS.find((w) => w.day === prefs.photoWeekday);

  return (
    <Screen>
      <MenuGroup>
        {routine ? (
          <ReminderRow
            label="Tägliche Erinnerung"
            help="Eine Mitteilung, wenn es Zeit für die Routine ist. Passt es gerade nicht, halte sie gedrückt und verschiebe sie."
            timeLabel="Jeden Tag um"
            when={clockTime(prefs.hour, prefs.minute)}
            value={prefs.reminder}
            onToggle={(v) => (v ? void turnOn({ reminder: true }, 'daily') : off({ reminder: false }))}
            onEdit={() => setEditing('daily')}
          />
        ) : null}
        <ReminderRow
          label="Wöchentliches Foto"
          help="Eine Erinnerung an dein Fortschrittsfoto."
          timeLabel={`Immer ${photoDay?.long ?? ''} um`}
          when={clockTime(prefs.photoHour, prefs.photoMinute)}
          value={prefs.photoReminder}
          onToggle={(v) => (v ? void turnOn({ photoReminder: true }, 'photo') : off({ photoReminder: false }))}
          onEdit={() => setEditing('photo')}
        />
      </MenuGroup>
      {editing === 'daily' ? (
        <ReminderPopup
          title="Tägliche Erinnerung"
          hint="Wann ist Zeit für deine Routine?"
          hour={prefs.hour}
          minute={prefs.minute}
          onSave={(hour, minute) => save({ hour, minute })}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {editing === 'photo' ? (
        <ReminderPopup
          title="Wöchentliches Foto"
          hint="An welchem Tag und um wie viel Uhr?"
          hour={prefs.photoHour}
          minute={prefs.photoMinute}
          weekday={prefs.photoWeekday}
          onSave={(photoHour, photoMinute, photoWeekday) => save({ photoHour, photoMinute, photoWeekday: photoWeekday ?? prefs.photoWeekday })}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}
