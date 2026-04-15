import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Product } from '@/services/odata';

const STORAGE_KEY = 'vena_b2b_favorites';

const storage = {
  get: (): Product[] => {
    try {
      if (Platform.OS === 'web') {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      }
    } catch {}
    return [];
  },
  set: (data: Product[]) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {}
  },
};

interface FavoritesContextType {
  favorites: Product[];
  favoriteCount: number;
  isFavorite: (key: string) => boolean;
  toggleFavorite: (product: Product) => void;
  removeFromFavorites: (key: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Product[]>([]);

  useEffect(() => {
    setFavorites(storage.get());
  }, []);

  // Set для O(1) пошуку замість O(n) Array.some()
  const favSet = useMemo(() => new Set(favorites.map((p) => p.Ref_Key)), [favorites]);

  const isFavorite = useCallback((key: string) => favSet.has(key), [favSet]);

  const toggleFavorite = useCallback((product: Product) => {
    setFavorites((prev) => {
      const next = favSet.has(product.Ref_Key)
        ? prev.filter((p) => p.Ref_Key !== product.Ref_Key)
        : [...prev, product];
      storage.set(next);
      return next;
    });
  }, [favSet]);

  const removeFromFavorites = useCallback((key: string) => {
    setFavorites((prev) => {
      const next = prev.filter((p) => p.Ref_Key !== key);
      storage.set(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    favorites,
    favoriteCount: favorites.length,
    isFavorite,
    toggleFavorite,
    removeFromFavorites,
  }), [favorites, isFavorite, toggleFavorite, removeFromFavorites]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
