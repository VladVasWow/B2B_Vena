import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { BlurView } from 'expo-blur';
import { getProductsByCategories, getProductsByRootCategory, searchProducts, getAllCategories, getProductPrices, getUnitsByKeys, Category, Product, ProductPrice } from '@/services/odata';
import { getImageUrl } from '@/constants/api';
import { AppHeader } from '@/components/AppHeader';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { effectivePriceTypeKey } from '@/services/odata';
import { useFavorites } from '@/contexts/FavoritesContext';
import { ProductCard } from '@/components/ProductCard';

const CARD_MIN_WIDTH = 210;
const GAP = 8;
const LIST_PADDING = 16;
const PAGE_SIZE = 30;
const MOBILE_BREAKPOINT = 768;

const NEXT_PAGE_SENTINEL = '__next_page__';
type GridItem = Product | { Ref_Key: typeof NEXT_PAGE_SENTINEL };

// --- Дерево категорій ---

interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

// Повертає ключі всіх листових нащадків (категорій без дітей)
// Якщо сама категорія — лист, повертає [key]
function getLeafKeys(key: string, allCats: Category[]): string[] {
  const children = allCats.filter((c) => c.Parent_Key === key);
  if (children.length === 0) return [key];
  return children.flatMap((c) => getLeafKeys(c.Ref_Key, allCats));
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
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedKey === node.category.Ref_Key;

  return (
    <View>
      <View style={[styles.treeItem, isSelected && styles.treeItemSelected, { paddingLeft: 12 + depth * 14 }]}>
        {/* Стрілка — лише розгортає/згортає, не закриває drawer */}
        <Pressable
          hitSlop={8}
          onPress={() => hasChildren && setExpanded((v) => !v)}
          style={styles.treeArrowBtn}
        >
          <Text style={styles.treeArrow}>
            {hasChildren ? (expanded ? '▼' : '▶') : '  '}
          </Text>
        </Pressable>
        {/* Назва — вибирає категорію (і закриває drawer на мобільному) */}
        <Pressable style={styles.treeLabelBtn} onPress={() => onSelect(node.category.Ref_Key)}>
          <Text style={[styles.treeLabel, isSelected && styles.treeLabelSelected]} numberOfLines={2}>
            {node.category.Description}
          </Text>
        </Pressable>
      </View>
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
      {/* Рядок 1: фото + код/назва + серце */}
      <View style={styles.rowTop}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={styles.rowImage} contentFit="contain" cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.rowImage, styles.rowImagePlaceholder]}>
            <Text style={{ fontSize: 14, color: '#CBD5E1' }}>—</Text>
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.productCode}>{item.Code}</Text>
          <Text style={styles.rowName} numberOfLines={2}>{item.Description}</Text>
        </View>
        <Pressable onPress={() => toggleFavorite(item)} hitSlop={8} style={styles.rowHeartBtn}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? '#EF4444' : '#CBD5E1'} />
        </Pressable>
      </View>

      {/* Рядок 2: чіпи + кнопка */}
      <View style={styles.rowBottom}>
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
        <Pressable style={styles.rowAddBtn} onPress={handleAddToCart}>
          <Text style={styles.rowAddText}>+ В кошик</Text>
        </Pressable>
      </View>
    </View>
  );
}

// --- Бічна панель категорій ---

interface SidebarContentProps {
  tree: CategoryNode[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  rootId: string;
  rootName: string;
}

function SidebarContent({ tree, selectedKey, onSelect, rootId, rootName }: SidebarContentProps) {
  const isRootSelected = selectedKey === rootId;
  return (
    <ScrollView>
      {/* Корінь — всі товари категорії */}
      <Pressable
        style={[styles.treeItem, styles.treeRootItem, isRootSelected && styles.treeItemSelected]}
        onPress={() => onSelect(rootId)}
      >
        <Text style={[styles.treeLabel, styles.treeRootLabel, isRootSelected && styles.treeLabelSelected]} numberOfLines={2}>
          Всі товари: {rootName}
        </Text>
      </Pressable>

      {(tree ?? []).map((node) => (
        <CategoryNodeView
          key={node.category.Ref_Key}
          node={node}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
  );
}

// --- Головний екран ---

export default function CategoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { priceType } = useAuth();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  const [catsLoading, setCatsLoading] = useState(true);
  const [prodsLoading, setProdsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ціни та одиниці виміру
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [units, setUnits] = useState<Map<string, string>>(new Map());
  const priceTypeKey = effectivePriceTypeKey(priceType);

  // Завантаження категорій + автовибір кореня при зміні кореневої категорії
  useEffect(() => {
    if (!id) return;
    setSelectedKey(id); // автоматично вибираємо "Всі товари"
    setProducts([]);
    setPrices([]);
    setUnits(new Map());
    setPage(0);
    setSearchQuery('');
    setIsSearching(false);
    setError(null);

    setCatsLoading(true);
    getAllCategories(id)
      .then((cats) => setAllCategories(cats))
      .catch((e) => setError(e.message))
      .finally(() => setCatsLoading(false));

    // Завантажуємо товари кореневої категорії одразу
    // loadProducts навмисно не в deps — ефект має спрацьовувати лише при зміні id
    loadProducts(id, 0); // eslint-disable-line react-hooks/exhaustive-deps
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Спільний хелпер завантаження цін та одиниць — не залежить від інших useCallback
  const applyPricesAndUnits = useCallback(async (items: Product[]) => {
    if (!items.length || !priceTypeKey) { setPrices([]); setUnits(new Map()); return; }
    const productKeys = items.map((p) => p.Ref_Key);
    const fetchedPrices = await getProductPrices(productKeys, priceTypeKey, priceType);
    setPrices(fetchedPrices);
    const unitKeys = [...new Set(fetchedPrices.map((p) => p.ЕдиницаИзмерения_Key))];
    const fetchedUnits = await getUnitsByKeys(unitKeys);
    setUnits(new Map(fetchedUnits.map((u) => [u.Ref_Key, u.Description])));
  }, [priceTypeKey, priceType]);

  // Завантаження товарів при виборі категорії або зміні сторінки
  // - корінь (key === id): всі товари через КорневаяКатегория_Key
  // - підкатегорія з дітьми: фільтр по листових нащадках через or
  // - листова підкатегорія: звичайний фільтр по одній категорії
  const loadProducts = useCallback((key: string, pageNum: number) => {
    setProdsLoading(true);
    setError(null);
    let fetcher: Promise<{ items: Product[]; hasMore: boolean }>;
    if (key === id) {
      fetcher = getProductsByRootCategory(key, pageNum, PAGE_SIZE);
    } else {
      const leafKeys = getLeafKeys(key, allCategories);
      fetcher = getProductsByCategories(leafKeys, pageNum, PAGE_SIZE);
    }
    fetcher
      .then(async ({ items, hasMore: more }) => {
        setProducts(items);
        setHasMore(more);
        await applyPricesAndUnits(items);
      })
      .catch((e: Error) => {
        if (e.message.includes('431')) {
          setError('Забагато підкатегорій для одного запиту. Будь ласка, виберіть конкретну підкатегорію.');
        } else {
          setError(e.message);
        }
      })
      .finally(() => setProdsLoading(false));
  }, [id, allCategories, applyPricesAndUnits]);

  const handleSelect = useCallback((key: string) => {
    setSelectedKey(key);
    setPage(0);
    setSearchQuery('');
    setIsSearching(false);
    loadProducts(key, 0);
  }, [loadProducts]);

  const handlePageChange = useCallback((newPage: number) => {
    if (!selectedKey) return;
    setPage(newPage);
    if (isSearching) {
      doSearch(searchQuery, newPage);
    } else {
      loadProducts(selectedKey, newPage);
    }
  }, [selectedKey, isSearching, searchQuery, loadProducts]);

  const doSearch = useCallback((q: string, pageNum: number) => {
    if (q.trim().length < 2) {
      setIsSearching(false);
      if (selectedKey) loadProducts(selectedKey, 0);
      return;
    }
    setIsSearching(true);
    setProdsLoading(true);
    searchProducts(q.trim(), pageNum, PAGE_SIZE, false)
      .then(async ({ items, hasMore: more }) => {
        setProducts(items);
        setHasMore(more);
        setPage(pageNum);
        await applyPricesAndUnits(items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setProdsLoading(false));
  }, [selectedKey, loadProducts, applyPricesAndUnits]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setIsSearching(false);
      if (selectedKey) loadProducts(selectedKey, 0);
    }
  }, [selectedKey, loadProducts]);

  const handleSearchSubmit = useCallback(() => doSearch(searchQuery, 0), [doSearch, searchQuery]);

  const tree = useMemo(() => buildTree(allCategories, id ?? ''), [allCategories, id]);

  const handleSidebarSelect = useCallback((key: string) => {
    setDrawerOpen(false);
    handleSelect(key);
  }, [handleSelect]);

  const numColumns = useMemo(() => {
    const cw = isMobile ? width - 16 : width * 0.82;
    return Math.max(2, Math.floor(cw / CARD_MIN_WIDTH));
  }, [isMobile, width]);

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

      {/* Drawer (mobile) */}
      {isMobile && (
        <Modal visible={drawerOpen} transparent animationType="fade" onRequestClose={() => setDrawerOpen(false)}>
          <View style={styles.drawerOverlay}>
            <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
            <BlurView intensity={70} tint="light" style={styles.drawerPanel}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>Підкатегорії</Text>
                <Pressable onPress={() => setDrawerOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color="#475569" />
                </Pressable>
              </View>
              <SidebarContent tree={tree} selectedKey={selectedKey} onSelect={handleSidebarSelect} rootId={id ?? ''} rootName={name ?? ''} />
            </BlurView>
          </View>
        </Modal>
      )}

      <View style={styles.body}>
        {/* Ліва панель — тільки на широких екранах */}
        {!isMobile && (
          <View style={styles.sidebar}>
            <SidebarContent tree={tree} selectedKey={selectedKey} onSelect={handleSidebarSelect} rootId={id ?? ''} rootName={name ?? ''} />
          </View>
        )}

        {/* Права панель */}
        <View style={styles.content}>
          <View style={styles.searchRow}>
            {isMobile && (
              <Pressable style={styles.hamburger} onPress={() => setDrawerOpen(true)}>
                <Ionicons name="menu" size={22} color="#475569" />
              </Pressable>
            )}
            <TextInput
              style={[styles.searchInput, isMobile && styles.searchInputFlex]}
              placeholder="Пошук за назвою або кодом..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearchChange}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
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
                <FlatList<GridItem>
                  data={hasMore ? [...products, { Ref_Key: NEXT_PAGE_SENTINEL }] : products}
                  keyExtractor={(item) => item.Ref_Key}
                  key={`grid-${numColumns}`}
                  numColumns={numColumns}
                  renderItem={({ item }) => (
                    <View style={{ width: `${(100 / numColumns).toFixed(3)}%` as `${number}%`, paddingHorizontal: GAP / 2 }}>
                      {item.Ref_Key === NEXT_PAGE_SENTINEL ? (
                        <Pressable style={styles.nextPageCard} onPress={() => handlePageChange(page + 1)}>
                          <Text style={styles.nextPageCardText}>›</Text>
                          <Text style={styles.nextPageCardLabel}>Наступна{'\n'}сторінка</Text>
                        </Pressable>
                      ) : (
                        <ProductCard item={item as Product} prices={prices} units={units} />
                      )}
                    </View>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>Немає товарів у цій підкатегорії</Text>
                  }
                  contentContainerStyle={styles.productList}
                />
              ) : (
                <FlatList<GridItem>
                  data={hasMore ? [...products, { Ref_Key: NEXT_PAGE_SENTINEL }] : products}
                  keyExtractor={(item) => item.Ref_Key}
                  key="list"
                  renderItem={({ item }) => item.Ref_Key === NEXT_PAGE_SENTINEL ? (
                    <Pressable style={styles.nextPageBtn} onPress={() => handlePageChange(page + 1)}>
                      <Text style={styles.nextPageBtnText}>Наступна сторінка →</Text>
                    </Pressable>
                  ) : (
                    <ProductRow item={item as Product} prices={prices} units={units} />
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
  treeArrowBtn: { paddingRight: 4, justifyContent: 'center' },
  treeArrow: { fontSize: 10, color: '#94A3B8', marginTop: 2, width: 14 },
  treeLabelBtn: { flex: 1 },
  treeLabel: { fontSize: 13, color: '#334155', lineHeight: 18 },
  treeLabelSelected: { color: '#1D4ED8', fontWeight: '600' },
  treeRootItem: { paddingLeft: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', marginBottom: 4 },
  treeRootLabel: { fontSize: 13, color: '#0F172A' },

  content: { flex: 1, paddingHorizontal: 8, paddingTop: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hamburger: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInputFlex: {},

  // Drawer
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerPanel: {
    width: 280,
    position: 'absolute',
    top: 0, left: 0, bottom: 0,
    overflow: 'hidden',
  },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  drawerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
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
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowSeparator: { height: 6 },
  rowImage: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#F8FAFC', flexShrink: 0 },
  rowImagePlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' },
  rowInfo: { flex: 1 },
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

  nextPageCard: {
    flex: 1,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
    gap: 8,
  },
  nextPageCardText: { fontSize: 36, color: '#2563EB', fontWeight: '300' },
  nextPageCardLabel: { fontSize: 13, fontWeight: '600', color: '#2563EB', textAlign: 'center' },

  nextPageBtn: {
    marginVertical: 4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
  },
  nextPageBtnText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },

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
