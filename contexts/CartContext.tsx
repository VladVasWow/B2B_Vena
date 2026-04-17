import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Product } from '@/services/odata';

export interface CartItem {
  product: Product;
  quantity: number;
  unitKey: string;
  unitName: string;
  price: number; // ціна за одиницю
}

// Унікальний ключ позиції = товар + одиниця виміру
export function cartItemId(productKey: string, unitKey: string) {
  return `${productKey}__${unitKey}`;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, unitKey: string, unitName: string, price: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItemPrice: (productKey: string, unitKey: string, newPrice: number) => void;
  clearCart: () => void;
  itemCount: number;
  totalAmount: number;
}

const STORAGE_KEY = 'vena_b2b_cart';

const storage = {
  get: (): CartItem[] => {
    try {
      if (Platform.OS === 'web') {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch {}
    return [];
  },
  set: (data: CartItem[]) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {}
  },
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(storage.get());
  }, []);

  const addToCart = (product: Product, unitKey: string, unitName: string, price: number) => {
    const id = cartItemId(product.Ref_Key, unitKey);
    setItems((prev) => {
      const existing = prev.find((i) => cartItemId(i.product.Ref_Key, i.unitKey) === id);
      const next = existing
        ? prev.map((i) =>
            cartItemId(i.product.Ref_Key, i.unitKey) === id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          )
        : [...prev, { product, quantity: 1, unitKey, unitName, price }];
      storage.set(next);
      return next;
    });
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => cartItemId(i.product.Ref_Key, i.unitKey) !== id);
      storage.set(next);
      return next;
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setItems((prev) => {
      const next = prev.map((i) =>
        cartItemId(i.product.Ref_Key, i.unitKey) === id ? { ...i, quantity } : i
      );
      storage.set(next);
      return next;
    });
  };

  const updateItemPrice = useCallback((productKey: string, unitKey: string, newPrice: number) => {
    const id = cartItemId(productKey, unitKey);
    setItems((prev) => {
      const next = prev.map((i) =>
        cartItemId(i.product.Ref_Key, i.unitKey) === id ? { ...i, price: newPrice } : i
      );
      storage.set(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => { storage.set([]); setItems([]); }, []);

  const itemCount = useMemo(() => items.length, [items]);
  const totalAmount = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, addToCart, removeFromCart, updateQuantity, updateItemPrice, clearCart, itemCount, totalAmount }),
    [items, addToCart, removeFromCart, updateQuantity, updateItemPrice, clearCart, itemCount, totalAmount]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
