import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  const isFavorite = (key: string) => favorites.some((p) => p.Ref_Key === key);

  const toggleFavorite = (product: Product) => {
    setFavorites((prev) => {
      const next = isFavorite(product.Ref_Key)
        ? prev.filter((p) => p.Ref_Key !== product.Ref_Key)
        : [...prev, product];
      storage.set(next);
      return next;
    });
  };

  const removeFromFavorites = (key: string) => {
    setFavorites((prev) => {
      const next = prev.filter((p) => p.Ref_Key !== key);
      storage.set(next);
      return next;
    });
  };

  return (
    <FavoritesContext.Provider value={{ favorites, favoriteCount: favorites.length, isFavorite, toggleFavorite, removeFromFavorites }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
