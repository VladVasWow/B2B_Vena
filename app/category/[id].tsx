import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProducts, searchProducts, getAllCategories, getProductPrices, getUnitsByKeys, Category, Product, ProductPrice, Unit } from '@/services/odata';
import { getImageUrl } from '@/constants/api';
import { AppHeader } from '@/components/AppHeader';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { ProductCard } from '@/components/ProductCard';

const CARD_MIN_WIDTH = 180;
const GAP = 8;
const LIST_PADDING = 16;

const PAGE_SIZE = 30;

// --- Дерево категорій ---

interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

function buildTree(categories: Category[], parentKey: string): CategoryNode[] {
  return categories
    .filter((c) => c.Parent_Key === parentKey)
    .map((c) => ({
      category: c,
      children: buildTree(categories, c.Ref_Key),
    }));
}

interface CategoryNodeProps {
  node: CategoryNode;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  depth?: number;
}

function CategoryNodeView({ node, selectedKey, onSelect, depth = 0 }: CategoryNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedKey === node.category.Ref_Key;

  return (
    <View>
      <Pressable
        style={[styles.treeItem, isSelected && styles.treeItemSelected, { paddingLeft: 12 + depth * 14 }]}
        onPress={() => {
          onSelect(node.category.Ref_Key);
          if (hasChildren) setExpanded((v) => !v);
        }}
      >
        <Text style={styles.treeArrow}>
          {hasChildren ? (expanded ? '▼' : '▶') : '  '}
        </Text>
        <Text style={[styles.treeLabel, isSelected && styles.treeLabelSelected]} numberOfLines={2}>
          {node.category.Description}
        </Text>
      </Pressable>
      {expanded && node.children.map((child) => (
        <CategoryNodeView
          key={child.category.Ref_Key}
          node={child}
          selectedKey={selectedKey}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </View>
  );
}

// --- Рядок товару (список) ---

interface ProductRowProps {
  item: Product;
  prices?: ProductPrice[];
  units?: Map<string, string>;
}

function ProductRow({ item, prices, units }: ProductRowProps) {
  const imgUrl = getImageUrl(item.ОсновноеИзображение?.Ref_Key, item.ОсновноеИзображение?.Формат);
  const itemPrices = prices?.filter((p) => p.Номенклатура_Key === item.Ref_Key) ?? [];
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(item.Ref_Key);

  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(
    itemPrices.length > 0 ? itemPrices[0].ЕдиницаИзмерения_Key : null
  );

  const effectiveSelected = itemPrices.find((p) => p.ЕдиницаИзмерения_Key === selectedUnitKey)
    ? selectedUnitKey
    : itemPrices[0]?.ЕдиницаИзмерения_Key ?? null;

  const selectedPrice = itemPrices.find((p) => p.ЕдиницаИзмерения_Key === effectiveSelected);

  const handleAddToCart = () => {
    if (!effectiveSelected || !selectedPrice) { addToCart(item, '', '', 0); return; }
    addToCart(item, effectiveSelected, units?.get(effectiveSelected) ?? '—', selectedPrice.Цена);
  };

  return (
    <View style={styles.rowItem}>
      {/* Фото */}
      {imgUrl ? (
        <Image source={{ uri: imgUrl }} style={styles.rowImage} resizeMode="contain" />
      ) : (
        <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
          <Text style={styles.productImageNoPhoto}>—</Text>
        </View>
      )}

      {/* Код + назва */}
      <View style={styles.rowInfo}>
        <Text style={styles.productCode}>{item.Code}</Text>
        <Text style={styles.rowName} numberOfLines={2}>{item.Description}</Text>
      </View>

      {/* Одиниці виміру (горизонтальні чіпи) */}
      {itemPrices.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rowChips}
          contentContainerStyle={styles.rowChipsContent}
        >
          {itemPrices.map((p) => {
            const isActive = p.ЕдиницаИзмерения_Key === effectiveSelected;
            return (
              <Pressable
                key={p.ЕдиницаИзмерения_Key}
                style={[styles.rowChip, isActive && styles.rowChipSelected]}
                onPress={() => setSelectedUnitKey(p.ЕдиницаИзмерения_Key)}
              >
                <Text style={[styles.rowChipUnit, isActive && styles.rowChipUnitSelected]}>
                  {units?.get(p.ЕдиницаИзмерения_Key) ?? '—'}
                </Text>
                <Text style={[styles.rowChipPrice, isActive && styles.rowChipPriceSelected]}>
                  {p.Цена.toFixed(2)} грн
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.rowChips} />
      )}

      {/* Серце */}
      <Pressable onPress={() => toggleFavorite(item)} hitSlop={8} style={styles.rowHeartBtn}>
        <Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? '#EF4444' : '#CBD5E1'} />
      </Pressable>

      {/* Кнопка */}
      <Pressable style={styles.rowAddBtn} onPress={handleAddToCart}>
        <Text style={styles.rowAddText}>+ В кошик</Text>
      </Pressable>
    </View>
  );
}

// --- Головний екран ---

export default function CategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { contract } = useAuth();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { width } = useWindowDimensions();

  const [catsLoading, setCatsLoading] = useState(true);
  const [prodsLoading, setProdsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ціни та одиниці виміру
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [units, setUnits] = useState<Map<string, string>>(new Map());
  const priceTypeKey = contract?.ТипЦенПродажи_Key ?? '';

  // Завантаження категорій
  useEffect(() => {
    if (!id) return;
    setCatsLoading(true);
    getAllCategories()
      .then((cats) => {
        const rootCats = cats.filter(
          (c) => c.КорневаяКатегория_Key === id || c.Parent_Key === id
        );
        setAllCategories(rootCats);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCatsLoading(false));
  }, [id]);

  // Збираємо всі ключі вузла + нащадків (BFS)
  const collectKeys = useCallback((key: string): string[] => {
    const result: string[] = [];
    const queue = [key];
    while (queue.length > 0) {
      const k = queue.shift()!;
      result.push(k);
      allCategories.filter((c) => c.Parent_Key === k).forEach((c) => queue.push(c.Ref_Key));
    }
    return result;
  }, [allCategories]);

  // Завантаження товарів при виборі категорії або зміні сторінки
  const loadProducts = useCallback((key: string, pageNum: number) => {
    setProdsLoading(true);
    setError(null);
    getProducts(key, pageNum, PAGE_SIZE)
      .then(({ items, hasMore: more }) => {
        setProducts(items);
        setHasMore(more);
        if (items.length > 0 && priceTypeKey) {
          const productKeys = items.map((p) => p.Ref_Key);
          getProductPrices(productKeys, priceTypeKey).then((fetchedPrices) => {
            setPrices(fetchedPrices);
            const unitKeys = [...new Set(fetchedPrices.map((p) => p.ЕдиницаИзмерения_Key))];
            getUnitsByKeys(unitKeys).then((fetchedUnits) => {
              setUnits(new Map(fetchedUnits.map((u) => [u.Ref_Key, u.Description])));
            });
          });
        } else {
          setPrices([]);
          setUnits(new Map());
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setProdsLoading(false));
  }, [priceTypeKey]);

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    setPage(0);
    setSearchQuery('');
    setIsSearching(false);
    loadProducts(key, 0);
  };

  const handlePageChange = (newPage: number) => {
    if (!selectedKey) return;
    setPage(newPage);
    if (isSearching) {
      doSearch(searchQuery, newPage);
    } else {
      loadProducts(selectedKey, newPage);
    }
  };

  const doSearch = useCallback((q: string, pageNum: number) => {
    if (q.trim().length < 2) {
      setIsSearching(false);
      if (selectedKey) loadProducts(selectedKey, 0);
      return;
    }
    setIsSearching(true);
    setProdsLoading(true);
    searchProducts(q.trim(), pageNum, PAGE_SIZE, false)
      .then(({ items, hasMore: more }) => {
        setProducts(items);
        setHasMore(more);
        setPage(pageNum);
        if (items.length > 0 && priceTypeKey) {
          const productKeys = items.map((p) => p.Ref_Key);
          getProductPrices(productKeys, priceTypeKey).then((fetchedPrices) => {
            setPrices(fetchedPrices);
            const unitKeys = [...new Set(fetchedPrices.map((p) => p.ЕдиницаИзмерения_Key))];
            getUnitsByKeys(unitKeys).then((fetchedUnits) => {
              setUnits(new Map(fetchedUnits.map((u) => [u.Ref_Key, u.Description])));
            });
          });
        } else {
          setPrices([]);
          setUnits(new Map());
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setProdsLoading(false));
  }, [selectedKey, loadProducts, priceTypeKey]);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setIsSearching(false);
      if (selectedKey) loadProducts(selectedKey, 0);
    }
  };

  const handleSearchSubmit = () => doSearch(searchQuery, 0);

  const tree = useMemo(() => buildTree(allCategories, id ?? ''), [allCategories, id]);
  const contentWidth = width * 0.82;
  const numColumns = Math.max(2, Math.floor(contentWidth / CARD_MIN_WIDTH));
  const cardWidth = (contentWidth - LIST_PADDING - GAP * (numColumns - 1)) / numColumns;

  if (catsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader showBack title={name ?? 'Категорія'} />

      <View style={styles.body}>
        {/* Ліва панель */}
        <View style={styles.sidebar}>
          <ScrollView>
            {tree.map((node) => (
              <CategoryNodeView
                key={node.category.Ref_Key}
                node={node}
                selectedKey={selectedKey}
                onSelect={handleSelect}
              />
            ))}
            {tree.length === 0 && (
              <Text style={styles.emptyText}>Немає підкатегорій</Text>
            )}
          </ScrollView>
        </View>

        {/* Права панель */}
        <View style={styles.content}>
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
          {!selectedKey && !isSearching ? (
            <Text style={styles.emptyText}>Оберіть підкатегорію</Text>
          ) : prodsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          ) : error ? (
            <Text style={styles.errorText}>❌ {error}</Text>
          ) : (
            <>
              {/* Тулбар: лічильник + перемикач виду */}
              <View style={styles.toolbar}>
                <Text style={styles.countText}>
                  Сторінка {page + 1} · {products.length} товарів
                </Text>
                <View style={styles.viewToggle}>
                  <Pressable
                    style={[styles.viewBtn, viewMode === 'grid' && styles.viewBtnActive]}
                    onPress={() => setViewMode('grid')}
                  >
                    <Ionicons name="grid-outline" size={17} color={viewMode === 'grid' ? '#2563EB' : '#94A3B8'} />
                  </Pressable>
                  <Pressable
                    style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
                    onPress={() => setViewMode('list')}
                  >
                    <Ionicons name="list-outline" size={17} color={viewMode === 'list' ? '#2563EB' : '#94A3B8'} />
                  </Pressable>
                </View>
              </View>

              {viewMode === 'grid' ? (
                <FlatList
                  data={products}
                  keyExtractor={(item) => item.Ref_Key}
                  key={`grid-${numColumns}`}
                  numColumns={numColumns}
                  columnWrapperStyle={numColumns > 1 ? { gap: GAP } : undefined}
                  renderItem={({ item }) => (
                    <ProductCard
                      item={item}
                      width={cardWidth}
                      prices={prices}
                      units={units}
                    />
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>Немає товарів у цій підкатегорії</Text>
                  }
                  contentContainerStyle={styles.productList}
                />
              ) : (
                <FlatList
                  data={products}
                  keyExtractor={(item) => item.Ref_Key}
                  key="list"
                  renderItem={({ item }) => (
                    <ProductRow
                      item={item}
                      prices={prices}
                      units={units}
                    />
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>Немає товарів у цій підкатегорії</Text>
                  }
                  contentContainerStyle={styles.productList}
                  ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
                />
              )}

              {(page > 0 || hasMore) && (
                <View style={styles.pagination}>
                  <Pressable
                    style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                    onPress={() => handlePageChange(page - 1)}
                    disabled={page === 0}
                  >
                    <Text style={styles.pageBtnText}>‹</Text>
                  </Pressable>

                  <Text style={styles.pageInfo}>{page + 1}</Text>

                  <Pressable
                    style={[styles.pageBtn, !hasMore && styles.pageBtnDisabled]}
                    onPress={() => handlePageChange(page + 1)}
                    disabled={!hasMore}
                  >
                    <Text style={styles.pageBtnText}>›</Text>
                  </Pressable>
                </View>
              )}
            </>
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

  sidebar: {
    width: '18%', borderRightWidth: 1,
    borderRightColor: '#E2E8F0', backgroundColor: '#F1F5F9',
  },
  treeItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E2E8F0',
  },
  treeItemSelected: { backgroundColor: '#DBEAFE' },
  treeArrow: { fontSize: 10, color: '#94A3B8', marginRight: 4, marginTop: 2, width: 14 },
  treeLabel: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
  treeLabelSelected: { color: '#1D4ED8', fontWeight: '600' },

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
    marginBottom: 8,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4,
  },
  countText: { fontSize: 12, color: '#64748B' },
  viewToggle: { flexDirection: 'row', gap: 4 },
  viewBtn: {
    width: 30, height: 30, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  viewBtnActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  productList: { paddingBottom: 16 },
  productCode: { fontSize: 11, color: '#94A3B8', marginBottom: 4 },
  rowHeartBtn: { padding: 4 },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 24 },

  // --- List view ---
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
  },
  rowSeparator: { height: 6 },
  rowImage: { width: 64, height: 64, borderRadius: 6, backgroundColor: '#F8FAFC' },
  rowImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  rowInfo: { width: 200 },
  rowName: { fontSize: 12, color: '#1E293B', fontWeight: '500', lineHeight: 17, marginTop: 2 },
  rowChips: { flex: 1 },
  rowChipsContent: { gap: 5, alignItems: 'center', paddingVertical: 2 },
  rowChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  rowChipSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  rowChipUnit: { fontSize: 11, color: '#64748B' },
  rowChipUnitSelected: { color: '#1D4ED8', fontWeight: '600' },
  rowChipPrice: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  rowChipPriceSelected: { color: '#1D4ED8', fontWeight: '700' },
  rowAddBtn: {
    backgroundColor: '#2563EB', borderRadius: 6,
    paddingVertical: 7, paddingHorizontal: 12, alignItems: 'center',
  },
  rowAddText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

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
