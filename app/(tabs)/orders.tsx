import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { getOrders, Order } from '@/services/odata';

const PAGE_SIZE = 20;

function resolveStatus(o: Order): { label: string; bg: string; text: string } {
  if (!o.Posted)        return { label: 'Чорновик',           bg: '#F1F5F9', text: '#64748B' };
  if (!o.Утвержден)     return { label: 'Не погоджено',       bg: '#FEFCE8', text: '#CA8A04' };
  if (o.ЕстьРасход)     return { label: 'Відвантажено',       bg: '#ECFDF5', text: '#059669' };
  if (o.ЕстьСчет)       return { label: 'Рахунок виставлено', bg: '#F5F3FF', text: '#7C3AED' };
  if (o.ЕстьЗаказПокупателя) return { label: 'В роботі',     bg: '#FFF7ED', text: '#EA580C' };
  return                       { label: 'Погоджено',          bg: '#EFF6FF', text: '#2563EB' };
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const sc = resolveStatus(order);
  const num = order.НомерЗаказа || order.Number;
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} onPress={onPress}>
      {/* Рядок 1: назва + номер + дата */}
      <View style={styles.row1}>
        <Text style={styles.docTitle} numberOfLines={1}>
          Комерційна пропозиція № {num} від {formatDate(order.Date)}
        </Text>
      </View>
      {/* Рядок 2: коментар якщо є */}
      {order.Комментарий ? (
        <Text style={styles.docComment} numberOfLines={1}>{order.Комментарий}</Text>
      ) : null}
      {/* Рядок 3: статус + сума */}
      <View style={styles.row2}>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Text style={[styles.statusText, { color: sc.text }]}>{sc.label}</Text>
        </View>
        <Text style={styles.docSum}>{order.СуммаДокумента.toFixed(2)} грн</Text>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const { contractor, contract } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = (p: number) => {
    if (!contractor || !contract) return;
    setLoading(true);
    setError(null);
    getOrders(contractor.Ref_Key, contract.Ref_Key, p, PAGE_SIZE)
      .then(({ items, hasMore: more }) => {
        setOrders(items);
        setHasMore(more);
        setPage(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // Оновлюємо список кожного разу, коли вкладка отримує фокус (включно з першим монтуванням)
  useFocusEffect(useCallback(() => { load(0); }, [contractor?.Ref_Key, contract?.Ref_Key]));

  return (
    <View style={styles.container}>
      <AppHeader title="Замовлення" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="receipt-outline" size={56} color="#CBD5E1" />
          <Text style={styles.emptyText}>Замовлень не знайдено</Text>
          <Text style={styles.emptyHint}>Замовлення по вашому договору відсутні</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={orders}
            keyExtractor={(o) => o.Ref_Key}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                onPress={() => router.push({ pathname: '/order/[id]', params: { id: item.Ref_Key, number: item.НомерЗаказа || item.Number, date: item.Date } })}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
          {(page > 0 || hasMore) && (
            <View style={styles.pagination}>
              <Pressable
                style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                onPress={() => load(page - 1)}
                disabled={page === 0}
              >
                <Text style={styles.pageBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.pageInfo}>{page + 1}</Text>
              <Pressable
                style={[styles.pageBtn, !hasMore && styles.pageBtnDisabled]}
                onPress={() => load(page + 1)}
                disabled={!hasMore}
              >
                <Text style={styles.pageBtnText}>›</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#334155' },
  emptyHint: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 32 },
  list: { padding: 16 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 6,
  },
  row1: {},
  docTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  docComment: { fontSize: 12, color: '#64748B', fontStyle: 'italic' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '600' },
  row2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  docSum: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },

  pagination: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', padding: 12, gap: 16,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#CBD5E1' },
  pageBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  pageInfo: { fontSize: 14, color: '#475569', fontWeight: '500' },
});
