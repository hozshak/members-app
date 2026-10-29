// Notifications by e-mail: when something new is unlocked, and when somebody answers a comment of mine — the same
// switches as on the website (PATCH /api/profile, notifyUnlock / notifyReply). Saved at once.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import { ErrorView, Loading, MenuGroup, Screen, ToggleRow, Txt } from '@/components/ui';
import { errorText } from '@/lib/api';
import { useProfile } from '@/lib/queries';
import { useApi } from '@/lib/session';
import { space } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export default function NotificationsScreen() {
  const api = useApi();
  const qc = useQueryClient();
  const q = useProfile();
  const save = useMutation({
    mutationFn: (patch: Partial<Pick<Profile, 'notifyUnlock' | 'notifyReply'>>) => api.patch<Profile>('/api/profile', patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ['profile'] });
      const before = qc.getQueryData<Profile>(['profile']);
      if (before) qc.setQueryData<Profile>(['profile'], { ...before, ...patch });
      return { before };
    },
    onError: (err, _patch, ctx) => {
      if (ctx?.before) qc.setQueryData(['profile'], ctx.before);
      Alert.alert('Nicht gespeichert', errorText(err));
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorView error={q.error} onRetry={() => void q.refetch()} />;
  const pr = q.data;

  return (
    <Screen>
      <View style={{ gap: space.s }}>
        <Txt variant="heading">Per E-Mail</Txt>
        <MenuGroup>
          <ToggleRow
            label="Neue Inhalte freigeschaltet"
            help="Wenn für dich etwas Neues freigeschaltet wird."
            value={pr.notifyUnlock.mail}
            onValueChange={(mail) => save.mutate({ notifyUnlock: { ...pr.notifyUnlock, mail } })}
          />
          <ToggleRow
            label="Antworten auf meine Kommentare"
            help="Wenn jemand auf deinen Kommentar antwortet."
            value={pr.notifyReply.mail}
            onValueChange={(mail) => save.mutate({ notifyReply: { ...pr.notifyReply, mail } })}
          />
        </MenuGroup>
      </View>
      <Txt variant="small" muted>Mitteilungen direkt aufs Handy kommen mit dem nächsten Update der App.</Txt>
    </Screen>
  );
}
