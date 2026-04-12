import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';
import {
  getTopCategories,
  getHomePageItems,
  getCategoriesByKeys,
  getProductsByKeys,
  getProductPrices,
  getUnitsByKeys,
  searchProducts,
  Category,
  Product,
  ProductPrice,
} from '@/services/odata';
import { getImageUrl } from '@/constants/api';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { ProductCard } from '@/components/ProductCard';

const PAGE_SIZE = 30;
const GAP = 8;
const CARD_MIN_WIDTH = 160;

// --- Картка категорії (вибрана) ---
function FeaturedCategoryCard({ item, onPress }: { item: Category; onPress: () => void }) {
  const imgUrl = getImageUrl(item.ОсновноеИзображение?.Ref_Key, item.ОсновноеИзображение?.Формат);
  return (
    <Pressable style={({ pressed }) => [styles.featCatCard, pressed && { opacity: 0.75 }]} onPress={onPress}>
      {imgUrl
        ? <Image source={{ uri: imgUrl }} style={styles.featCatImage} resizeMode="cover" />
        : <View style={styles.featCatImagePlaceholder} />}
      <Text style={styles.featCatName} numberOfLines={2}>{item.Description}</Text>
    </Pressable>
  );
}

// --- Допоміжна функція завантаження цін ---
async function loadPricesAndUnits(
  products: Product[],
  priceTypeKey: string,
): Promise<{ prices: ProductPrice[]; units: Map<string, string> }> {
  if (!products.length || !priceTypeKey) return { prices: [], units: new Map() };
  const productKeys = products.map((p) => p.Ref_Key);
  const fetchedPrices = await getProductPrices(productKeys, priceTypeKey);
  const unitKeys = [...new Set(fetchedPrices.map((p) => p.ЕдиницаИзмерения_Key))];
  const fetchedUnits = await getUnitsByKeys(unitKeys);
  return {
    prices: fetchedPrices,
    units: new Map(fetchedUnits.map((u) => [u.Ref_Key, u.Description])),
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { contract } = useAuth();
  const { width } = useWindowDimensions();

  const priceTypeKey = contract?.ТипЦенПродажи_Key ?? '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredCats, setFeaturedCats] = useState<Category[]>([]);
  const [featuredProds, setFeaturedProds] = useState<Product[]>([]);
  const [featuredPrices, setFeaturedPrices] = useState<ProductPrice[]>([]);
  const [featuredUnits, setFeaturedUnits] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchPrices, setSearchPrices] = useState<ProductPrice[]>([]);
  const [searchUnits, setSearchUnits] = useState<Map<string, string>>(new Map());
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    Promise.all([
      getTopCategories(),
      getHomePageItems(),
    ])
      .then(async ([cats, items]) => {
        setCategories(cats);
        const catKeys = items
          .filter((i) => i.Элемент_Type === 'StandardODATA.Catalog_КатегорииТоваров')
          .map((i) => i.Элемент);
        const prodKeys = items
          .filter((i) => i.Элемент_Type === 'StandardODATA.Catalog_Номенклатура')
          .map((i) => i.Элемент);

        const [fCats, fProds] = await Promise.all([
          getCategoriesByKeys(catKeys),
          getProductsByKeys(prodKeys),
        ]);
        setFeaturedCats(fCats);
        setFeaturedProds(fProds);

        // Завантажуємо ціни для рекомендованих товарів
        if (fProds.length > 0 && priceTypeKey) {
          const { prices, units } = await loadPricesAndUnits(fProds, priceTypeKey);
          setFeaturedPrices(prices);
          setFeaturedUnits(units);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [priceTypeKey]);

  const doSearch = (q: string, page: number) => {
    if (q.trim().length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchPrices([]);
      setSearchUnits(new Map());
      return;
    }
    setIsSearching(true);
    setSearchLoading(true);
    searchProducts(q.trim(), page, PAGE_SIZE, false)
      .then(async ({ items, hasMore }) => {
        setSearchResults(items);
        setSearchHasMore(hasMore);
        if (items.length > 0 && priceTypeKey) {
          const { prices, units } = await loadPricesAndUnits(items, priceTypeKey);
          setSearchPrices(prices);
          setSearchUnits(units);
        } else {
          setSearchPrices([]);
          setSearchUnits(new Map());
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setSearchLoading(false));
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchPrices([]);
      setSearchUnits(new Map());
    }
  };

  const handleSearchSubmit = () => { setSearchPage(0); doSearch(searchQuery, 0); };
  const handleSearchPage = (p: number) => { setSearchPage(p); doSearch(searchQuery, p); };

  // Адаптивна сітка для товарів
  const contentWidth = width * 0.78;
  const numColumns = Math.max(2, Math.floor(contentWidth / CARD_MIN_WIDTH));
  const cardWidth = (contentWidth - 16 - GAP * (numColumns - 1)) / numColumns;

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <AppHeader />
        <View style={styles.center}><Text style={styles.errorText}>❌ {error}</Text></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />
      <View style={styles.body}>

        {/* Ліва панель — категорії */}
        <View style={styles.sidebar}>
          <ScrollView>
            {categories.map((item) => (
              <Pressable
                key={item.Ref_Key}
                style={({ pressed }) => [styles.catItem, pressed && styles.catItemPressed]}
                onPress={() => router.push({ pathname: '/category/[id]', params: { id: item.Ref_Key, name: item.Description } })}
              >
                {(() => {
                  const imgUrl = getImageUrl(item.ОсновноеИзображение?.Ref_Key, item.ОсновноеИзображение?.Формат);
                  return imgUrl
                    ? <Image source={{ uri: imgUrl }} style={styles.catThumb} resizeMode="cover" />
                    : <View style={styles.catThumbPlaceholder} />;
                })()}
                <Text style={styles.catName} numberOfLines={3}>{item.Description}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Права панель */}
        <View style={styles.content}>
          {/* Пошук */}
          <TextInput
            style={styles.searchInput}
            placeholder="Пошук за назвою або кодом..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />

          {isSearching ? (
            searchLoading ? (
              <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
            ) : (
              <>
                <Text style={styles.sectionCount}>
                  {searchResults.length > 0 ? `Сторінка ${searchPage + 1} · ${searchResults.length} товарів` : 'Нічого не знайдено'}
                </Text>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.Ref_Key}
                  key={numColumns}
                  numColumns={numColumns}
                  columnWrapperStyle={numColumns > 1 ? { gap: GAP } : undefined}
                  renderItem={({ item }) => (
                    <ProductCard
                      item={item}
                      width={cardWidth}
                      prices={searchPrices}
                      units={searchUnits}
                      compact
                    />
                  )}
                  contentContainerStyle={styles.productList}
                  ListEmptyComponent={<Text style={styles.emptyText}>Нічого не знайдено</Text>}
                />
                {(searchPage > 0 || searchHasMore) && (
                  <View style={styles.pagination}>
                    <Pressable
                      style={[styles.pageBtn, searchPage === 0 && styles.pageBtnDisabled]}
                      onPress={() => handleSearchPage(searchPage - 1)}
                      disabled={searchPage === 0}
                    >
                      <Text style={styles.pageBtnText}>‹</Text>
                    </Pressable>
                    <Text style={styles.pageInfo}>{searchPage + 1}</Text>
                    <Pressable
                      style={[styles.pageBtn, !searchHasMore && styles.pageBtnDisabled]}
                      onPress={() => handleSearchPage(searchPage + 1)}
                      disabled={!searchHasMore}
                    >
                      <Text style={styles.pageBtnText}>›</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )
          ) : (
            <ScrollView contentContainerStyle={styles.homeContent}>

              {/* Вибрані категорії */}
              {featuredCats.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Найпопулярніші категорії</Text>
                  <View style={styles.featCatsRow}>
                    {featuredCats.map((cat) => (
                      <FeaturedCategoryCard
                        key={cat.Ref_Key}
                        item={cat}
                        onPress={() => router.push({ pathname: '/category/[id]', params: { id: cat.Ref_Key, name: cat.Description } })}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Рекомендовані товари */}
              {featuredProds.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Рекомендовані товари</Text>
                  <View style={[styles.productGrid, { gap: GAP }]}>
                    {featuredProds.map((prod) => (
                      <ProductCard
                        key={prod.Ref_Key}
                        item={prod}
                        width={cardWidth}
                        prices={featuredPrices}
                        units={featuredUnits}
                        compact
                      />
                    ))}
                  </View>
                </View>
              )}

            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, color: '#EF4444', textAlign: 'center', paddingHorizontal: 24 },

  body: { flex: 1, flexDirection: 'row' },

  // Ліва панель
  sidebar: {
    width: '22%',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  catItemPressed: { backgroundColor: '#DBEAFE' },
  catThumb: { width: 36, height: 36, borderRadius: 6, flexShrink: 0 },
  catThumbPlaceholder: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#E2E8F0', flexShrink: 0 },
  catName: { fontSize: 12, color: '#334155', lineHeight: 16, flex: 1 },

  // Права панель
  content: { flex: 1, paddingHorizontal: 8, paddingTop: 8 },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },

  // Секції
  homeContent: { paddingBottom: 24 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10, paddingHorizontal: 4 },
  sectionCount: { fontSize: 12, color: '#64748B', marginBottom: 8, paddingHorizontal: 4 },

  // Вибрані категорії
  featCatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  featCatCard: {
    width: 210,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  featCatImage: { width: '100%', height: 160, backgroundColor: '#F8FAFC' },
  featCatImagePlaceholder: { width: '100%', height: 160, backgroundColor: '#F1F5F9' },
  featCatName: { fontSize: 14, color: '#1E293B', lineHeight: 20, padding: 10, fontWeight: '600' },

  // Товари
  productGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  productList: { paddingBottom: 16 },

  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 24 },

  pagination: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 12, gap: 16,
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center',
  },
  pageBtnDisabled: { backgroundColor: '#CBD5E1' },
  pageBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  pageInfo: { fontSize: 14, color: '#475569', fontWeight: '500' },
});
