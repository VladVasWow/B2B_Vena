import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { getOrderLines, getProductsByKeys, getUnitsByKeys, OrderLine, Product } from '@/services/odata';

export default function OrderDetailScreen() {
  const { id, number, date } = useLocalSearchParams<{ id: string; number?: string; date?: string }>();

  const formattedDate = date
    ? new Date(date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const [lines, setLines] = useState<OrderLine[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [units, setUnits] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLines([]);
    setProducts(new Map());
    setUnits(new Map());
    setError(null);
    setLoading(true);
    getOrderLines(id)
      .then(async (fetchedLines) => {
        setLines(fetchedLines);

        const productKeys = [...new Set(fetchedLines.map((l) => l.Номенклатура_Key))];
        const unitKeys = [...new Set(fetchedLines.map((l) => l.ЕдиницаИзмерения_Key))];

        const [prods, fetchedUnits] = await Promise.all([
          productKeys.length ? getProductsByKeys(productKeys) : Promise.resolve([]),
          unitKeys.length ? getUnitsByKeys(unitKeys) : Promise.resolve([]),
        ]);

        setProducts(new Map(prods.map((p) => [p.Ref_Key, p])));
        setUnits(new Map(fetchedUnits.map((u) => [u.Ref_Key, u.Description])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const totalSum = lines.reduce((s, l) => s + l.Сумма, 0);
  const totalNds = lines.reduce((s, l) => s + l.СуммаНДС, 0);

  return (
    <View style={styles.container}>
      <AppHeader showBack title={`Комерційна пропозиція № ${number ?? ''} від ${formattedDate}`} fallbackHref="/(tabs)/orders" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>❌ {error}</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(l) => l.LineNumber}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.tableHeader}>
                <Text style={[styles.colCode, styles.headerText]}>#</Text>
                <Text style={[styles.colName, styles.headerText]}>Товар</Text>
                <Text style={[styles.colQty, styles.headerText]}>Кіл.</Text>
                <Text style={[styles.colPrice, styles.headerText]}>Ціна</Text>
                <Text style={[styles.colSum, styles.headerText]}>Сума</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const prod = products.get(item.Номенклатура_Key);
              const unitName = units.get(item.ЕдиницаИзмерения_Key) ?? '';
              return (
                <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
                  <View style={styles.colCode}>
                    <Text style={styles.lineNum}>{item.LineNumber}</Text>
                    <Text style={styles.prodCode}>{item.Код}</Text>
                  </View>
                  <View style={styles.colName}>
                    <Text style={styles.prodName} numberOfLines={3}>
                      {prod?.Description ?? item.Номенклатура_Key}
                    </Text>
                  </View>
                  <View style={styles.colQty}>
                    <Text style={styles.qty}>{item.Количество}</Text>
                    {unitName ? <Text style={styles.unit}>{unitName}</Text> : null}
                  </View>
                  <Text style={styles.colPrice}>
                    {item.ЦенаСНДС.toFixed(2)}
                  </Text>
                  <Text style={styles.colSum}>
                    {(item.Сумма + item.СуммаНДС).toFixed(2)}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Рядки відсутні</Text>
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          {lines.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>ПДВ:</Text>
                <Text style={styles.footerNds}>{totalNds.toFixed(2)} грн</Text>
              </View>
              <View style={styles.footerRow}>
                <Text style={styles.footerLabel}>Разом з ПДВ:</Text>
                <Text style={styles.footerSum}>{(totalSum + totalNds).toFixed(2)} грн</Text>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: '#EF4444', textAlign: 'center', paddingHorizontal: 24 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 24 },

  list: { paddingBottom: 0 },

  // Колонки: код | назва | кількість | ціна | сума
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerText: { fontSize: 11, fontWeight: '700', color: '#64748B' },

  colCode: { width: 58 },
  colName: { flex: 1, paddingHorizontal: 8 },
  colQty: { width: 54, alignItems: 'center' },
  colPrice: { width: 70, textAlign: 'right', fontSize: 13, color: '#1E293B' },
  colSum: { width: 76, textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#0F172A', paddingRight: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  rowAlt: { backgroundColor: '#F8FAFC' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0' },

  lineNum: { fontSize: 10, color: '#94A3B8', marginBottom: 2 },
  prodCode: { fontSize: 11, fontWeight: '600', color: '#334155' },
  prodName: { fontSize: 12, color: '#1E293B', lineHeight: 16 },
  qty: { fontSize: 13, fontWeight: '600', color: '#1E293B', textAlign: 'center' },
  unit: { fontSize: 10, color: '#94A3B8', textAlign: 'center' },

  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: { fontSize: 13, color: '#64748B' },
  footerNds: { fontSize: 13, color: '#64748B' },
  footerSum: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
});
