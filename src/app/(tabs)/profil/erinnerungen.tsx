// The reminders of the routine (local notifications of the phone): the daily one, which can be moved from the notification itself
// ("In 1 Stunde", lib/routine.ts), and the weekly photo. A switch per reminder; while it is on a tap on its time opens a popup, which
// saves only with "Speichern".
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { ReminderPopup } from '@/components/reminder-popup';
import { MenuGroup, Screen, ToggleRow, Txt } from '@/components/ui';
import { mainRoutine } from '@/lib/plans';
import { allowNotifications, clockTime, REMINDER_DAYS, syncReminders, useRoutinePrefs, useRoutines, type RoutinePrefs } from '@/lib/routine';
import { space, usePalette } from '@/lib/theme';

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
