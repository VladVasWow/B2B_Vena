import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { effectivePriceTypeKey } from '@/services/odata';
import { getProductPrices, getUnitsByKeys, Product, ProductPrice } from '@/services/odata';
import { getImageUrl } from '@/constants/api';

const GAP = 8;
const CARD_MIN_WIDTH = 160;

// --- Картка улюбленого товару ---
interface FavCardProps {
  item: Product;
  width: number;
  prices: ProductPrice[];
  units: Map<string, string>;
  onAddToCart: (p: Product, unitKey: string, unitName: string, price: number) => void;
  onRemove: (key: string) => void;
}

function FavCard({ item, width, prices, units, onAddToCart, onRemove }: FavCardProps) {
  const imgUrl = getImageUrl(item.ОсновноеИзображение?.Ref_Key, item.ОсновноеИзображение?.Формат);
  const itemPrices = prices.filter((p) => p.Номенклатура_Key === item.Ref_Key);

  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(
    itemPrices[0]?.ЕдиницаИзмерения_Key ?? null
  );

  const effectiveSelected = itemPrices.find((p) => p.ЕдиницаИзмерения_Key === selectedUnitKey)
    ? selectedUnitKey
    : itemPrices[0]?.ЕдиницаИзмерения_Key ?? null;

  const selectedPrice = itemPrices.find((p) => p.ЕдиницаИзмерения_Key === effectiveSelected);

  const handleAddToCart = () => {
    if (!effectiveSelected || !selectedPrice) { onAddToCart(item, '', '', 0); return; }
    onAddToCart(item, effectiveSelected, units.get(effectiveSelected) ?? '—', selectedPrice.Цена);
  };

  return (
    <View style={[styles.card, { width, marginBottom: GAP }]}>
      <View style={{ position: 'relative' }}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={styles.cardImage} contentFit="contain" cachePolicy="memory-disk" />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.noPhoto}>Фото відсутнє</Text>
          </View>
        )}
        <Pressable style={styles.removeBtn} onPress={() => onRemove(item.Ref_Key)} hitSlop={6}>
          <Ionicons name="heart" size={18} color="#EF4444" />
        </Pressable>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.code}>{item.Code}</Text>
        <Text style={styles.name} numberOfLines={3}>{item.Description}</Text>

        {itemPrices.length > 0 && (
          <View style={styles.priceList}>
            {itemPrices.map((p) => {
              const isActive = p.ЕдиницаИзмерения_Key === effectiveSelected;
              return (
                <Pressable
                  key={p.ЕдиницаИзмерения_Key}
                  style={[styles.priceRow, isActive && styles.priceRowSelected]}
                  onPress={() => setSelectedUnitKey(p.ЕдиницаИзмерения_Key)}
                >
                  <Text style={[styles.priceUnit, isActive && styles.priceUnitSelected]}>
                    {units.get(p.ЕдиницаИзмерения_Key) ?? '—'}
                  </Text>
                  <Text style={[styles.priceValue, isActive && styles.priceValueSelected]}>
                    {p.Цена.toFixed(2)} грн
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable style={styles.addBtn} onPress={handleAddToCart}>
          <Text style={styles.addBtnText}>+ В кошик</Text>
        </Pressable>
      </View>
    </View>
  );
}

// --- Головний екран ---
export default function FavoritesScreen() {
  const { favorites, removeFromFavorites } = useFavorites();
  const { addToCart } = useCart();
  const { priceType } = useAuth();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();

  const priceTypeKey = effectivePriceTypeKey(priceType);

  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [units, setUnits] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  const contentWidth = width;
  const numColumns = Math.max(2, Math.floor(contentWidth / CARD_MIN_WIDTH));
  const cardWidth = (contentWidth - 32 - GAP * (numColumns - 1)) / numColumns;

  useEffect(() => {
    if (!favorites.length || !priceTypeKey) {
      setPrices([]);
      setUnits(new Map());
      return;
    }
    setLoading(true);
    const keys = favorites.map((p) => p.Ref_Key);
    getProductPrices(keys, priceTypeKey, priceType)
      .then((fetchedPrices) => {
        setPrices(fetchedPrices);
        const unitKeys = [...new Set(fetchedPrices.map((p) => p.ЕдиницаИзмерения_Key))];
        return getUnitsByKeys(unitKeys);
      })
      .then((fetchedUnits) => {
        setUnits(new Map(fetchedUnits.map((u) => [u.Ref_Key, u.Description])));
      })
      .finally(() => setLoading(false));
  }, [favorites.length, priceTypeKey]);

  return (
    <View style={styles.container}>
      <AppHeader showBack title="Улюблені" />

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={56} color="#FDA4AF" />
          <Text style={styles.emptyText}>Список порожній</Text>
          <Text style={styles.emptyHint}>Натисніть ♡ на картці товару щоб додати</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.Ref_Key}
          key={numColumns}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? { gap: GAP } : undefined}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <FavCard
              item={item}
              width={cardWidth}
              prices={prices}
              units={units}
              onAddToCart={(p, unitKey, unitName, price) => { addToCart(p, unitKey, unitName, price); showToast('Додано до кошику'); }}
              onRemove={removeFromFavorites}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#334155' },
  emptyHint: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 32 },
  list: { padding: 16 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardImage: { width: '100%', height: 130, backgroundColor: '#F8FAFC' },
  cardImagePlaceholder: {
    width: '100%', height: 130,
    backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
  },
  noPhoto: { fontSize: 11, color: '#CBD5E1' },
  removeBtn: {
    position: 'absolute',
    top: 6, right: 6,
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { padding: 10, flex: 1, justifyContent: 'space-between' },
  code: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  name: { fontSize: 12, color: '#1E293B', lineHeight: 17, fontWeight: '500', marginBottom: 8 },

  priceList: { marginBottom: 8, gap: 3 },
  priceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 6,
    borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  priceRowSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  priceUnit: { fontSize: 11, color: '#64748B', flex: 1 },
  priceUnitSelected: { color: '#1D4ED8', fontWeight: '600' },
  priceValue: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  priceValueSelected: { color: '#1D4ED8', fontWeight: '700' },

  addBtn: {
    backgroundColor: '#2563EB', borderRadius: 6,
    paddingVertical: 7, alignItems: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});
