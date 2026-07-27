import React, { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, FAB, Surface, Chip } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { usePiggyBanks, type PiggyBank } from '@/hooks/usePiggyBanks';
import { EmptyState } from '@/components/EmptyState';
import { formatCents } from '@/lib/money';

export default function PiggyBanksScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { getAllPiggyBanks } = usePiggyBanks();
  const [piggyBanks, setPiggyBanks] = useState<PiggyBank[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const all = await getAllPiggyBanks();
        setPiggyBanks(all);
      }
      load();
    }, []),
  );

  const visible = showArchived ? piggyBanks : piggyBanks.filter((p) => !p.isArchived);
  const totalBalance = piggyBanks
    .filter((p) => !p.isArchived)
    .reduce((s, p) => s + p.balanceOnAccountCents + p.balanceCashCents, 0);
  const totalSpent = piggyBanks.reduce((s, p) => s + p.totalSpentAllTimeCents, 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>Piggy Banks</Text>
          <Text style={[styles.balance, { color: theme.colors.secondary }]}>{formatCents(totalBalance)}</Text>
          <Text style={[styles.sub, { color: theme.colors.onBackground + '66' }]}>
            total balance · {formatCents(totalSpent)} spent all-time
          </Text>
        </View>

        <View style={styles.chips}>
          <Chip
            selected={!showArchived}
            onPress={() => setShowArchived(false)}
            compact
            style={{ backgroundColor: !showArchived ? theme.colors.primary + '22' : theme.colors.surface }}
            textStyle={{ color: !showArchived ? theme.colors.primary : theme.colors.onSurface + '77' }}
          >
            Active
          </Chip>
          <Chip
            selected={showArchived}
            onPress={() => setShowArchived(true)}
            compact
            style={{ backgroundColor: showArchived ? theme.colors.primary + '22' : theme.colors.surface }}
            textStyle={{ color: showArchived ? theme.colors.primary : theme.colors.onSurface + '77' }}
          >
            All
          </Chip>
        </View>

        {visible.length === 0 ? (
          <EmptyState
            icon="piggy-bank"
            title="No piggy banks yet"
            description="Create a named savings bucket to start saving towards a goal."
          />
        ) : (
          visible.map((pb) => <PiggyBankItem key={pb.id} pb={pb} theme={theme} onPress={() => router.push({ pathname: '/piggy/[id]', params: { id: pb.id } })} />)
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color="#fff"
        onPress={() => router.push('/piggy/new')}
      />
    </View>
  );
}

function PiggyBankItem({ pb, theme, onPress }: { pb: PiggyBank; theme: any; onPress: () => void }) {
  const total = pb.balanceOnAccountCents + pb.balanceCashCents;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.custom.cardBorder }]}>
        <View style={[styles.icon, { backgroundColor: theme.colors.secondary + '22' }]}>
          <MaterialCommunityIcons name="piggy-bank" size={24} color={theme.colors.secondary} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Text style={[styles.cardName, { color: theme.colors.onSurface }]}>{pb.name}</Text>
            {pb.isArchived && (
              <View style={[styles.archivedBadge, { backgroundColor: theme.colors.outline + '55' }]}>
                <Text style={{ fontSize: 10, color: theme.colors.onSurface + '66' }}>archived</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardBalance, { color: theme.colors.secondary }]}>{formatCents(total)}</Text>
          <View style={styles.cardMeta}>
            <Text style={[styles.cardMetaText, { color: theme.colors.onSurface + '66' }]}>
              On account: {formatCents(pb.balanceOnAccountCents)}
            </Text>
            {pb.balanceCashCents > 0 && (
              <Text style={[styles.cardMetaText, { color: theme.colors.onSurface + '66' }]}>
                Cash: {formatCents(pb.balanceCashCents)}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.chevron, { color: theme.colors.onSurface + '44' }]}>›</Text>
      </Surface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 8 },
  header: { paddingTop: 48, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  balance: { fontSize: 32, fontWeight: '700', marginTop: 4 },
  sub: { fontSize: 13 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    elevation: 2,
  },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardBalance: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 2 },
  cardMetaText: { fontSize: 12 },
  archivedBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  chevron: { fontSize: 24 },
  fab: { position: 'absolute', right: 16, bottom: 80 },
});
