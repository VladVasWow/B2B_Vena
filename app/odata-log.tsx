import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, Stack } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { getLogEntries, clearLog, ODataLogEntry } from '@/services/odataLogger';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return '#059669';
  if (status >= 400 && status < 500) return '#D97706';
  if (status >= 500) return '#EF4444';
  return '#64748B';
}

function LogRow({ item, index }: { item: ODataLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const directUrl = item.fullUrl ?? '';

  return (
    <Pressable
      style={[styles.row, index % 2 === 1 && styles.rowAlt]}
      onPress={() => setExpanded((v) => !v)}
    >
      {/* Рядок 1: час + опис + статус */}
      <View style={styles.rowTop}>
        <Text style={styles.rowTime}>{formatTime(item.ts)}</Text>
        <Text style={styles.rowDesc} numberOfLines={expanded ? 0 : 1}>{item.description}</Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowStatus, { color: statusColor(item.status) }]}>{item.status}</Text>
          <Text style={styles.rowDur}>{item.durationMs}ms</Text>
          <Text style={styles.rowSize}>{formatSize(item.sizeBytes)}</Text>
        </View>
      </View>
      {/* Розгорнутий URL */}
      {expanded && (
        <Text style={styles.rowUrl} selectable>{directUrl}</Text>
      )}
    </Pressable>
  );
}

export default function ODataLogScreen() {
  const [entries, setEntries] = useState<ODataLogEntry[]>([]);

  useFocusEffect(useCallback(() => {
    setEntries(getLogEntries());
  }, []));

  const handleClear = () => {
    clearLog();
    setEntries([]);
  };

  const totalMs = entries.reduce((s, e) => s + e.durationMs, 0);
  const totalSize = entries.reduce((s, e) => s + e.sizeBytes, 0);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader showBack title="OData лог" />

      {/* Підсумок */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>{entries.length} запитів · {totalMs}ms · {formatSize(totalSize)}</Text>
        <Pressable style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Очистити</Text>
        </Pressable>
      </View>

      {/* Заголовок таблиці */}
      <View style={styles.header}>
        <Text style={[styles.headerCell, { width: 60 }]}>Час</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Запит</Text>
        <Text style={[styles.headerCell, { width: 38 }]}>Ст.</Text>
        <Text style={[styles.headerCell, { width: 56 }]}>Час</Text>
        <Text style={[styles.headerCell, { width: 64 }]}>Розмір</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        renderItem={({ item, index }) => <LogRow item={item} index={index} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Запитів ще не було</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  summaryText: { fontSize: 12, color: '#64748B' },
  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: '#FEE2E2', borderRadius: 6,
  },
  clearBtnText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: '#F1F5F9', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  headerCell: { fontSize: 11, fontWeight: '700', color: '#64748B' },

  row: {
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0',
  },
  rowAlt: { backgroundColor: '#F8FAFC' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTime: { width: 60, fontSize: 11, color: '#94A3B8', fontVariant: ['tabular-nums'] as any },
  rowDesc: { flex: 1, fontSize: 12, color: '#1E293B', fontWeight: '500' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowStatus: { width: 32, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  rowDur: { width: 50, fontSize: 11, color: '#64748B', textAlign: 'right' },
  rowSize: { width: 60, fontSize: 11, color: '#64748B', textAlign: 'right' },
  rowUrl: {
    marginTop: 5, fontSize: 11, color: '#1D4ED8',
    fontFamily: 'monospace', lineHeight: 16,
    backgroundColor: '#EFF6FF', padding: 8, borderRadius: 4,
  },

  empty: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 32 },
});
