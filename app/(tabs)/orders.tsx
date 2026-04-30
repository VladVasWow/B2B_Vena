import { useCallback, useRef, useState } from 'react';
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
  if (!o.Posted)        return { label: 'Чернетка',           bg: '#F1F5F9', text: '#64748B' };
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

// --- Пагінатор ---

function buildPages(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | '…')[] = [];
  pages.push(0);
  if (current > 2) pages.push('…');
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) pages.push(i);
  if (current < total - 3) pages.push('…');
  pages.push(total - 1);
  return pages;
}

function Paginator({ page, total, pageSize, onPage }: {
  page: number; total: number; pageSize: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const pages = buildPages(page, totalPages);
  return (
    <View style={styles.pagination}>
      <Pressable style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]} onPress={() => onPage(page - 1)} disabled={page === 0}>
        <Text style={styles.pageBtnText}>‹</Text>
      </Pressable>
      <View style={styles.pageNumbers}>
        {pages.map((p, i) =>
          p === '…' ? (
            <Text key={`dots-${i}`} style={styles.pageDots}>…</Text>
          ) : (
            <Pressable key={p} style={[styles.pageNum, p === page && styles.pageNumActive]} onPress={() => onPage(p)}>
              <Text style={[styles.pageNumText, p === page && styles.pageNumTextActive]}>{p + 1}</Text>
            </Pressable>
          )
        )}
      </View>
      <Pressable style={[styles.pageBtn, page === totalPages - 1 && styles.pageBtnDisabled]} onPress={() => onPage(page + 1)} disabled={page === totalPages - 1}>
        <Text style={styles.pageBtnText}>›</Text>
      </Pressable>
    </View>
  );
}

// --- Головний екран ---

export default function OrdersScreen() {
  const { contractor, contract } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Пам'ятаємо поточну сторінку між переходами
  const currentPageRef = useRef(0);

  const load = (p: number) => {
    if (!contractor || !contract) return;
    currentPageRef.current = p;
    setLoading(true);
    setError(null);
    getOrders(contractor.Ref_Key, contract.Ref_Key, p, PAGE_SIZE)
      .then(({ items, hasMore: more, total: t }) => {
        setOrders(items);
        setHasMore(more);
        setTotal(t);
        setPage(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // При поверненні на екран — перезавантажуємо ТУ САМУ сторінку (не скидаємо на 0)
  useFocusEffect(useCallback(() => { load(currentPageRef.current); }, [contractor?.Ref_Key, contract?.Ref_Key]));

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
          {total > PAGE_SIZE && (
            <Paginator page={page} total={total} pageSize={PAGE_SIZE} onPage={load} />
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
    justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, gap: 8,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  pageBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#CBD5E1' },
  pageBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  pageNumbers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageNum: {
    minWidth: 34, height: 34, borderRadius: 8,
    paddingHorizontal: 6,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  pageNumActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  pageNumText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  pageNumTextActive: { color: '#FFFFFF' },
  pageDots: { fontSize: 14, color: '#94A3B8', paddingHorizontal: 2 },
});
