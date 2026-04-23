import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getProductsByKeys, getProductPrices, getUnitsByKeys,
  getProductProperties, getPropertyNames, getPropertyValues,
  getProductImages,
  Product, ProductPrice, ProductProperty, ProductImage,
} from '@/services/odata';
import { getProduct } from '@/services/productCache';
import { getImageUrl } from '@/constants/api';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { effectivePriceTypeKey } from '@/services/odata';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useToast } from '@/contexts/ToastContext';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { priceType } = useAuth();
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { showToast } = useToast();

  const priceTypeKey = effectivePriceTypeKey(priceType);

  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [units, setUnits] = useState<Map<string, string>>(new Map());
  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(null);
  const [propNames, setPropNames] = useState<Map<string, string>>(new Map());
  const [propValues, setPropValues] = useState<Map<string, string>>(new Map());
  const [properties, setProperties] = useState<ProductProperty[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const cachedProduct = id ? getProduct(id) : null;
  const [galleryWidth, setGalleryWidth] = useState(width);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    // Якщо товар є в пам'яті (прийшли з каталогу) — пропускаємо запит хвилі 1

    const loadDetails = async (prod: Product) => {
      setProduct(prod);

      // Хвиля 2: паралельно ціни + характеристики + зображення
      const [fetchedPrices, fetchedProps, fetchedImages] = await Promise.all([
        priceTypeKey ? getProductPrices([id], priceTypeKey, priceType) : Promise.resolve([]),
        getProductProperties(id),
        getProductImages(id),
      ]);

      setImages(fetchedImages);
      setActiveImageIndex(0);

      setPrices(fetchedPrices);
      setSelectedUnitKey(fetchedPrices[0]?.ЕдиницаИзмерения_Key ?? null);
      if (fetchedPrices.length) {
        const unitKeys = [...new Set(fetchedPrices.map((p) => p.ЕдиницаИзмерения_Key))];
        const fetchedUnits = await getUnitsByKeys(unitKeys);
        setUnits(new Map(fetchedUnits.map((u) => [u.Ref_Key, u.Description])));
      }

      setProperties(fetchedProps);
      if (fetchedProps.length) {
        const nameKeys = [...new Set(fetchedProps.map((p) => p.Свойство_Key))];
        const valueKeys = [...new Set(fetchedProps.map((p) => p.Значение_Key))];
        const [names, values] = await Promise.all([
          getPropertyNames(nameKeys),
          getPropertyValues(valueKeys),
        ]);
        setPropNames(new Map(names.map((n) => [n.Ref_Key, n.Description])));
        setPropValues(new Map(values.map((v) => [v.Ref_Key, v.Description])));
      }
    };

    if (cachedProduct) {
      // Хвиля 1 пропускається — одразу хвиля 2
      loadDetails(cachedProduct)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      // Fallback (глибоке посилання, пряма навігація) — хвиля 1 → хвиля 2
      getProductsByKeys([id])
        .then(async (products) => {
          const prod = products[0] ?? null;
          if (!prod) return;
          await loadDetails(prod);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [id, priceTypeKey]);

  const effectiveSelected = prices.find((p) => p.ЕдиницаИзмерения_Key === selectedUnitKey)
    ? selectedUnitKey
    : prices[0]?.ЕдиницаИзмерения_Key ?? null;

  const selectedPrice = prices.find((p) => p.ЕдиницаИзмерения_Key === effectiveSelected);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(
      product,
      effectiveSelected ?? '',
      effectiveSelected ? (units.get(effectiveSelected) ?? '—') : '',
      selectedPrice?.Цена ?? 0,
    );
    showToast('Додано до кошику');
    setAdded(true);
    const t = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(t);
  };

  const fav = product ? isFavorite(product.Ref_Key) : false;
  const imgUrl = product
    ? getImageUrl(product.ОсновноеИзображение?.Ref_Key, product.ОсновноеИзображение?.Формат)
    : null;

  const headerTitle = product?.Description ?? 'Товар';

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader showBack title={cachedProduct?.Description ?? 'Товар'} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.container}>
        <AppHeader showBack title={cachedProduct?.Description ?? 'Товар'} />
        <View style={styles.center}>
          <Text style={styles.errorText}>❌ {error ?? 'Товар не знайдено'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader showBack title={headerTitle} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={isMobile ? undefined : styles.desktopRow}>

        {/* Галерея зображень */}
        <View style={[styles.imageWrap, !isMobile && styles.imageWrapDesktop]} onLayout={(e) => setGalleryWidth(e.nativeEvent.layout.width)}>
          {images.length > 0 ? (
            <View style={{ width: '100%', flexShrink: 0 }}>
              <FlatList
                ref={flatListRef}
                data={images}
                keyExtractor={(img) => img.Ref_Key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / galleryWidth);
                  setActiveImageIndex(idx);
                }}
                scrollEventThrottle={16}
                renderItem={({ item: img }) => {
                  const url = getImageUrl(img.Ref_Key, img.Формат);
                  return (
                    <View style={{ width: galleryWidth, height: 300 }}>
                      {url ? (
                        <Image source={{ uri: url }} style={{ width: galleryWidth, height: 300 }} contentFit="contain" cachePolicy="memory-disk" />
                      ) : (
                        <View style={[styles.imagePlaceholder, { width: galleryWidth }]}>
                          <Ionicons name="image-outline" size={48} color="#CBD5E1" />
                        </View>
                      )}
                    </View>
                  );
                }}
              />
              {images.length > 1 && (
                <View style={styles.dotsRow}>
                  {images.map((_, i) => (
                    <Pressable
                      key={i}
                      onPress={() => {
                        flatListRef.current?.scrollToOffset({ offset: i * galleryWidth, animated: true });
                        setActiveImageIndex(i);
                      }}
                      style={[styles.dot, i === activeImageIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : imgUrl ? (
            <Image source={{ uri: imgUrl }} style={[styles.image, { flexShrink: 0 }]} contentFit="contain" cachePolicy="memory-disk" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={48} color="#CBD5E1" />
              <Text style={styles.noPhotoText}>Фото відсутнє</Text>
            </View>
          )}
        </View>

        {/* Деталі */}
        <View style={[styles.details, !isMobile && styles.detailsDesktop]}>

          {/* Коди + серце */}
          <View style={styles.codeRow}>
            <View style={styles.codes}>
              {product.Code ? (
                <Text style={styles.codeText}>Код: {product.Code}</Text>
              ) : null}
              {product.Артикул ? (
                <Text style={styles.codeText}>Артикул: {product.Артикул}</Text>
              ) : null}
            </View>
            <Pressable
              style={[styles.heartBtn, fav && styles.heartBtnActive]}
              onPress={() => toggleFavorite(product)}
              hitSlop={8}
            >
              <Ionicons
                name={fav ? 'heart' : 'heart-outline'}
                size={22}
                color={fav ? '#EF4444' : '#94A3B8'}
              />
            </Pressable>
          </View>

          {/* Назва */}
          <Text style={styles.productName}>{product.Description}</Text>

          {/* Ціни */}
          <View style={styles.pricesSection}>
            <Text style={styles.pricesSectionTitle}>Ціна</Text>
            {prices.length > 0 ? (
              <View style={styles.priceList}>
                {prices.map((p) => {
                  const isActive = p.ЕдиницаИзмерения_Key === effectiveSelected;
                  return (
                    <Pressable
                      key={p.ЕдиницаИзмерения_Key}
                      style={[styles.priceChip, isActive && styles.priceChipActive]}
                      onPress={() => setSelectedUnitKey(p.ЕдиницаИзмерения_Key)}
                    >
                      <Text style={[styles.priceChipUnit, isActive && styles.priceChipUnitActive]}>
                        {units.get(p.ЕдиницаИзмерения_Key) ?? '—'}
                      </Text>
                      <Text style={[styles.priceChipValue, isActive && styles.priceChipValueActive]}>
                        {p.Цена.toFixed(2)} грн
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.noPriceText}>Ціна за запитом</Text>
            )}
          </View>

          {/* Кнопка в кошик */}
          <Pressable
            style={[styles.addBtn, added && styles.addBtnDone]}
            onPress={handleAddToCart}
          >
            <Ionicons
              name={added ? 'checkmark' : 'cart-outline'}
              size={20}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.addBtnText}>
              {added ? 'Додано!' : 'Додати в кошик'}
            </Text>
          </Pressable>

          {/* Характеристики */}
          {properties.length > 0 && (
            <View style={styles.propsSection}>
              <Text style={styles.propsSectionTitle}>Характеристики</Text>
              <View style={styles.propsTable}>
                {properties.map((prop, idx) => {
                  const name = propNames.get(prop.Свойство_Key) ?? '—';
                  const value = propValues.get(prop.Значение_Key) ?? '—';
                  return (
                    <View key={prop.Свойство_Key} style={[styles.propRow, idx % 2 === 0 && styles.propRowEven]}>
                      <Text style={styles.propName}>{name.trim()}</Text>
                      <Text style={styles.propValue}>{value.trim()}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

        </View>
        </View>{/* desktopRow */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, color: '#EF4444', textAlign: 'center', paddingHorizontal: 24 },
  scroll: { paddingBottom: 32 },

  desktopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // Зображення
  imageWrap: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  imageWrapDesktop: {
    width: '45%',
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    position: 'sticky' as any,
    top: 0,
    alignSelf: 'flex-start',
    height: '100vh' as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: 300 },
  imagePlaceholder: {
    width: '100%', height: 300,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  noPhotoText: { fontSize: 13, color: '#CBD5E1' },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    backgroundColor: '#2563EB',
    width: 18,
  },

  // Деталі
  details: { padding: 20, gap: 16 },
  detailsDesktop: { flex: 1 },

  codeRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  codes: { gap: 2, flex: 1 },
  codeText: { fontSize: 12, color: '#94A3B8' },

  heartBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  heartBtnActive: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },

  productName: {
    fontSize: 18, fontWeight: '700', color: '#0F172A', lineHeight: 26,
  },

  // Ціни
  pricesSection: { gap: 10 },
  pricesSectionTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  priceList: { gap: 8 },
  priceChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  priceChipActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  priceChipUnit: { fontSize: 14, color: '#475569', fontWeight: '500' },
  priceChipUnitActive: { color: '#1D4ED8', fontWeight: '700' },
  priceChipValue: { fontSize: 16, color: '#64748B', fontWeight: '700' },
  priceChipValueActive: { color: '#1D4ED8', fontSize: 18 },
  noPriceText: { fontSize: 14, color: '#94A3B8', fontStyle: 'italic' },

  // Характеристики
  propsSection: { gap: 10 },
  propsSectionTitle: { fontSize: 13, fontWeight: '600', color: '#475569' },
  propsTable: {
    borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden',
  },
  propRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 9, paddingHorizontal: 12, gap: 8,
    backgroundColor: '#FFFFFF',
  },
  propRowEven: { backgroundColor: '#F8FAFC' },
  propName: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 18 },
  propValue: { flex: 1, fontSize: 13, color: '#1E293B', fontWeight: '500', lineHeight: 18, textAlign: 'right' },

  // Кнопка
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingVertical: 15, marginTop: 4,
  },
  addBtnDone: { backgroundColor: '#059669' },
  addBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
