import { useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Product, ProductPrice } from '@/services/odata';
import { getImageUrl } from '@/constants/api';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useToast } from '@/contexts/ToastContext';

export interface ProductCardProps {
  item: Product;
  width?: number; // якщо не передано — карточка розтягується на всю доступну ширину (flex: 1)
  prices?: ProductPrice[];
  units?: Map<string, string>;
  compact?: boolean; // менші розміри для головної сторінки
}

export function ProductCard({ item, width, prices, units, compact = false }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  const imgUrl = getImageUrl(item.ОсновноеИзображение?.Ref_Key, item.ОсновноеИзображение?.Формат);
  const itemPrices = prices?.filter((p) => p.Номенклатура_Key === item.Ref_Key) ?? [];
  const fav = isFavorite(item.Ref_Key);

  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(
    itemPrices[0]?.ЕдиницаИзмерения_Key ?? null
  );

  const effectiveSelected = itemPrices.find((p) => p.ЕдиницаИзмерения_Key === selectedUnitKey)
    ? selectedUnitKey
    : itemPrices[0]?.ЕдиницаИзмерения_Key ?? null;

  const selectedPrice = itemPrices.find((p) => p.ЕдиницаИзмерения_Key === effectiveSelected);

  const handleAddToCart = (e: GestureResponderEvent) => {
    e.stopPropagation();
    if (!effectiveSelected || !selectedPrice) {
      addToCart(item, '', '', 0);
      showToast('Додано до кошику');
      return;
    }
    addToCart(item, effectiveSelected, units?.get(effectiveSelected) ?? '—', selectedPrice.Цена);
    showToast(`${item.Description.slice(0, 40)}${item.Description.length > 40 ? '…' : ''} — додано до кошику`);
  };

  const handleToggleFavorite = (e: GestureResponderEvent) => {
    e.stopPropagation();
    toggleFavorite(item);
  };

  const handlePriceSelect = (e: GestureResponderEvent, unitKey: string) => {
    e.stopPropagation();
    setSelectedUnitKey(unitKey);
  };

  const imgHeight = compact ? 110 : 130;

  return (
    <Pressable
      style={[styles.card, width != null ? { width, marginBottom: 8 } : { flex: 1, marginBottom: 8 }]}
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.Ref_Key, name: item.Description } })}
    >
      <View style={{ position: 'relative' }}>
        <View style={styles.imageWrap}>
          {imgUrl ? (
            <Image source={{ uri: imgUrl }} style={[styles.image, { height: imgHeight }]} contentFit="contain" cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.imagePlaceholder, { height: imgHeight }]}>
              <Text style={styles.noPhoto}>Фото відсутнє</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.heartBtn} onPress={handleToggleFavorite} hitSlop={6}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={compact ? 15 : 17} color={fav ? '#EF4444' : '#94A3B8'} />
        </Pressable>
      </View>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text style={[styles.code, compact && styles.codeCompact]}>{item.Code}</Text>
        <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={3}>
          {item.Description}
        </Text>

        {itemPrices.length > 0 && (
          <View style={styles.priceList}>
            {itemPrices.map((p) => {
              const isActive = p.ЕдиницаИзмерения_Key === effectiveSelected;
              return (
                <Pressable
                  key={p.ЕдиницаИзмерения_Key}
                  style={[styles.priceRow, isActive && styles.priceRowSelected]}
                  onPress={(e) => handlePriceSelect(e, p.ЕдиницаИзмерения_Key)}
                >
                  <Text style={[styles.priceUnit, isActive && styles.priceUnitSelected]}>
                    {units?.get(p.ЕдиницаИзмерения_Key) ?? '—'}
                  </Text>
                  <Text style={[styles.priceValue, isActive && styles.priceValueSelected]}>
                    {p.Цена.toFixed(2)} грн
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable style={[styles.addBtn, compact && styles.addBtnCompact]} onPress={handleAddToCart}>
          <Text style={[styles.addBtnText, compact && styles.addBtnTextCompact]}>+ В кошик</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  imageWrap: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  image: { width: '100%', backgroundColor: '#F8FAFC' },
  imagePlaceholder: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhoto: { fontSize: 11, color: '#CBD5E1' },
  heartBtn: {
    position: 'absolute',
    top: 6, right: 6,
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 10, flex: 1, justifyContent: 'space-between' },
  bodyCompact: { padding: 8 },
  code: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  codeCompact: { fontSize: 10, marginBottom: 3 },
  name: { fontSize: 12, color: '#1E293B', lineHeight: 17, fontWeight: '500', marginBottom: 10 },
  nameCompact: { fontSize: 11, lineHeight: 15, marginBottom: 6 },
  priceList: { marginBottom: 8, gap: 3 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  priceRowSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  priceUnit: { fontSize: 11, color: '#64748B', flex: 1 },
  priceUnitSelected: { color: '#1D4ED8', fontWeight: '600' },
  priceValue: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  priceValueSelected: { color: '#1D4ED8', fontWeight: '700' },
  addBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 6,
    paddingVertical: 7,
    alignItems: 'center',
  },
  addBtnCompact: { paddingVertical: 6 },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  addBtnTextCompact: { fontSize: 11 },
});
