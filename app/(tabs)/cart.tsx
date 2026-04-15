import { useState } from 'react';
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
import { useCart, cartItemId } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { createOrder } from '@/services/odata';

export default function CartScreen() {
  const { items, removeFromCart, updateQuantity, clearCart, itemCount, totalAmount } = useCart();
  const { contractor, contract, priceType } = useAuth();
  const router = useRouter();

  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const handleOrder = async () => {
    if (!contractor || !contract || !items.length) return;
    setOrdering(true);
    setOrderError(null);
    try {
      const docKey = await createOrder({
        contractorKey: contractor.Ref_Key,
        contractKey: contract.Ref_Key,
        priceTypeKey: priceType?.Ref_Key ?? contract.ТипЦенПродажи_Key,
        currencyKey: contract.ВалютаВзаиморасчетов_Key,
        comment: '',
        items: items.map((i) => ({
          productKey: i.product.Ref_Key,
          unitKey: i.unitKey,
          quantity: i.quantity,
          price: i.price,
          vatRate: i.product.СтавкаНДС ?? 'НДС20',
        })),
      });
      clearCart();
      router.replace('/(tabs)/orders');
    } catch (e) {
      setOrderError((e as Error).message);
    } finally {
      setOrdering(false);
    }
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
});
