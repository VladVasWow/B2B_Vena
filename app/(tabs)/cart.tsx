import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { useCart, cartItemId } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { createOrder, getProductPrices, effectivePriceTypeKey } from '@/services/odata';
import { useToast } from '@/contexts/ToastContext';

interface PriceChange {
  productKey: string;
  unitKey: string;
  productName: string;
  unitName: string;
  oldPrice: number;
  newPrice: number;
}

export default function CartScreen() {
  const { items, removeFromCart, updateQuantity, updateItemPrice, clearCart, itemCount, totalAmount } = useCart();
  const { contractor, contract, priceType } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [showPriceModal, setShowPriceModal] = useState(false);

  const submitOrder = async (currentItems: typeof items) => {
    if (!contractor || !contract) return;
    setOrdering(true);
    setOrderError(null);
    try {
      await createOrder({
        contractorKey: contractor.Ref_Key,
        contractKey: contract.Ref_Key,
        priceTypeKey: priceType?.Ref_Key ?? contract.ТипЦенПродажи_Key,
        currencyKey: contract.ВалютаВзаиморасчетов_Key,
        comment: '',
        items: currentItems.map((i) => ({
          productKey: i.product.Ref_Key,
          unitKey: i.unitKey,
          quantity: i.quantity,
          price: i.price,
          vatRate: i.product.СтавкаНДС ?? 'НДС20',
        })),
      });
      clearCart();
      showToast('Замовлення успішно створено');
      router.replace('/(tabs)/orders');
    } catch (e) {
      setOrderError((e as Error).message);
    } finally {
      setOrdering(false);
    }
  };

  const handleOrder = async () => {
    if (!contractor || !contract || !items.length) return;
    const priceTypeKey = effectivePriceTypeKey(priceType);
    if (!priceTypeKey) { await submitOrder(items); return; }

    setOrdering(true);
    setOrderError(null);
    try {
      const productKeys = items.map((i) => i.product.Ref_Key);
      const freshPrices = await getProductPrices(productKeys, priceTypeKey, priceType);

      const changes: PriceChange[] = [];
      for (const item of items) {
        if (item.price === 0) continue; // товар без ціни — не перевіряємо
        const fresh = freshPrices.find(
          (p) => p.Номенклатура_Key === item.product.Ref_Key && p.ЕдиницаИзмерения_Key === item.unitKey
        );
        if (fresh && Math.abs(fresh.Цена - item.price) > 0.001) {
          changes.push({
            productKey: item.product.Ref_Key,
            unitKey: item.unitKey,
            productName: item.product.Description,
            unitName: item.unitName,
            oldPrice: item.price,
            newPrice: fresh.Цена,
          });
        }
      }

      if (changes.length > 0) {
        setPriceChanges(changes);
        setShowPriceModal(true);
        setOrdering(false);
      } else {
        await submitOrder(items);
      }
    } catch {
      // якщо не вдалось перевірити ціни — оформляємо з поточними
      await submitOrder(items);
    }
  };

  const handleConfirmWithNewPrices = async () => {
    setShowPriceModal(false);
    // оновлюємо ціни в кошику
    for (const ch of priceChanges) {
      updateItemPrice(ch.productKey, ch.unitKey, ch.newPrice);
    }
    // items ще не оновлені (стан асинхронний), тому будуємо оновлений список вручну
    const updatedItems = items.map((i) => {
      const ch = priceChanges.find(
        (c) => c.productKey === i.product.Ref_Key && c.unitKey === i.unitKey
      );
      return ch ? { ...i, price: ch.newPrice } : i;
    });
    await submitOrder(updatedItems);
  };

  return (
    <View style={styles.container}>
      <AppHeader showBack title="Кошик" />

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyText}>Кошик порожній</Text>
          <Text style={styles.emptyHint}>Додайте товари з каталогу</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(i) => cartItemId(i.product.Ref_Key, i.unitKey)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const id = cartItemId(item.product.Ref_Key, item.unitKey);
              const lineTotal = item.price * item.quantity;
              return (
                <View style={styles.cartItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemCode}>{item.product.Code}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>{item.product.Description}</Text>
                    {item.price > 0 && (
                      <Text style={styles.itemPrice}>
                        {item.price.toFixed(2)} грн/{item.unitName || 'од.'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.itemRight}>
                    <View style={styles.itemActions}>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQuantity(id, item.quantity - 1)}
                      >
                        <Text style={styles.qtyBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qty}>{item.quantity}</Text>
                      <Pressable
                        style={styles.qtyBtn}
                        onPress={() => updateQuantity(id, item.quantity + 1)}
                      >
                        <Text style={styles.qtyBtnText}>+</Text>
                      </Pressable>
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => removeFromCart(id)}
                      >
                        <Text style={styles.removeBtnText}>✕</Text>
                      </Pressable>
                    </View>
                    {lineTotal > 0 && (
                      <Text style={styles.lineTotal}>{lineTotal.toFixed(2)} грн</Text>
                    )}
                  </View>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          <View style={styles.footer}>
            <View style={styles.footerTotals}>
              <Text style={styles.totalLabel}>Всього: {itemCount} поз.</Text>
              {totalAmount > 0 && (
                <Text style={styles.totalAmount}>{totalAmount.toFixed(2)} грн</Text>
              )}
            </View>

            {orderError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{orderError}</Text>
              </View>
            ) : null}

            <View style={styles.footerBtns}>
              <Pressable
                style={[styles.clearBtn, ordering && styles.btnDisabled]}
                onPress={clearCart}
                disabled={ordering}
              >
                <Text style={styles.clearBtnText}>Очистити</Text>
              </Pressable>
              <Pressable
                style={[styles.orderBtn, ordering && styles.btnDisabled]}
                onPress={handleOrder}
                disabled={ordering}
              >
                {ordering ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.orderBtnText}>Оформити замовлення</Text>
                )}
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* Модальне вікно зміни цін */}
      <Modal visible={showPriceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={24} color="#F59E0B" />
              <Text style={styles.modalTitle}>Ціни змінились</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              З моменту додавання до кошику ціни на деякі товари змінились:
            </Text>
            <ScrollView style={styles.changesList} showsVerticalScrollIndicator={false}>
              {priceChanges.map((ch) => (
                <View key={`${ch.productKey}_${ch.unitKey}`} style={styles.changeRow}>
                  <Text style={styles.changeName} numberOfLines={2}>{ch.productName}</Text>
                  <View style={styles.changePrices}>
                    <Text style={styles.changeOld}>{ch.oldPrice.toFixed(2)} грн</Text>
                    <Ionicons name="arrow-forward" size={14} color="#64748B" />
                    <Text style={[
                      styles.changeNew,
                      ch.newPrice > ch.oldPrice ? styles.priceUp : styles.priceDown,
                    ]}>
                      {ch.newPrice.toFixed(2)} грн
                    </Text>
                    <Text style={styles.changeUnit}>/{ch.unitName || 'од.'}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Text style={styles.modalQuestion}>Оновити ціни і оформити замовлення?</Text>
            <View style={styles.modalBtns}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowPriceModal(false)}
              >
                <Text style={styles.modalBtnCancelText}>Скасувати</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleConfirmWithNewPrices}
              >
                <Text style={styles.modalBtnConfirmText}>Так, продовжити</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#334155' },
  emptyHint: { fontSize: 14, color: '#94A3B8' },
  list: { padding: 16 },
  cartItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemInfo: { flex: 1 },
  itemCode: { fontSize: 11, color: '#94A3B8', marginBottom: 2 },
  itemName: { fontSize: 13, color: '#1E293B', fontWeight: '500', lineHeight: 18, marginBottom: 6 },
  itemPrice: { fontSize: 11, color: '#64748B', marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center',
  },
  qtyBtnText: { fontSize: 16, color: '#2563EB', fontWeight: '700', lineHeight: 20 },
  qty: { fontSize: 15, fontWeight: '600', color: '#1E293B', minWidth: 24, textAlign: 'center' },
  removeBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { fontSize: 11, color: '#EF4444', fontWeight: '700' },
  lineTotal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  separator: { height: 8 },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  footerTotals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 15, fontWeight: '600', color: '#475569' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#FEF2F2', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444', lineHeight: 18 },
  footerBtns: { flexDirection: 'row', gap: 10 },
  clearBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center',
  },
  clearBtnText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  orderBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  orderBtnText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },

  // Модальне вікно
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 20, width: '100%', maxWidth: 480, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  modalSubtitle: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  changesList: { maxHeight: 240 },
  changeRow: {
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 4,
  },
  changeName: { fontSize: 13, color: '#1E293B', fontWeight: '500', lineHeight: 18 },
  changePrices: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeOld: { fontSize: 13, color: '#94A3B8', textDecorationLine: 'line-through' },
  changeNew: { fontSize: 14, fontWeight: '700' },
  changeUnit: { fontSize: 12, color: '#94A3B8' },
  priceUp: { color: '#EF4444' },
  priceDown: { color: '#059669' },
  modalQuestion: { fontSize: 14, fontWeight: '600', color: '#334155', marginTop: 4 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalBtnCancel: { borderWidth: 1, borderColor: '#CBD5E1' },
  modalBtnCancelText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  modalBtnConfirm: { backgroundColor: '#2563EB' },
  modalBtnConfirmText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
});
