import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
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
  clearCart: () => void;
  itemCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = (product: Product, unitKey: string, unitName: string, price: number) => {
    const id = cartItemId(product.Ref_Key, unitKey);
    setItems((prev) => {
      const existing = prev.find((i) => cartItemId(i.product.Ref_Key, i.unitKey) === id);
      if (existing) {
        return prev.map((i) =>
          cartItemId(i.product.Ref_Key, i.unitKey) === id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1, unitKey, unitName, price }];
    });
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((i) => cartItemId(i.product.Ref_Key, i.unitKey) !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        cartItemId(i.product.Ref_Key, i.unitKey) === id ? { ...i, quantity } : i
      )
    );
  };

  const clearCart = useCallback(() => setItems([]), []);

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalAmount = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, addToCart, removeFromCart, updateQuantity, clearCart, itemCount, totalAmount }),
    [items, addToCart, removeFromCart, updateQuantity, clearCart, itemCount, totalAmount]
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
