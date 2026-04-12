import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Contractor, Contract, PriceType } from '@/services/odata';

const STORAGE_KEY = 'vena_b2b_auth';

interface StoredAuth {
  contractor: Contractor;
  contract: Contract | null;
  priceType: PriceType | null;
}

const storage = {
  get: (): StoredAuth | null => {
    try {
      if (Platform.OS === 'web') {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      }
    } catch {}
    return null;
  },
  set: (data: StoredAuth) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {}
  },
  clear: () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  },
};

interface AuthContextType {
  contractor: Contractor | null;
  contract: Contract | null;
  priceType: PriceType | null;
  isLoading: boolean;
  login: (contractor: Contractor, contract: Contract | null, priceType: PriceType | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [priceType, setPriceType] = useState<PriceType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = storage.get();
    if (saved) {
      setContractor(saved.contractor);
      setContract(saved.contract);
      setPriceType(saved.priceType ?? null);
    }
    setIsLoading(false);
  }, []);

  const login = (c: Contractor, d: Contract | null, p: PriceType | null) => {
    setContractor(c);
    setContract(d);
    setPriceType(p);
    storage.set({ contractor: c, contract: d, priceType: p });
  };

  const logout = () => {
    setContractor(null);
    setContract(null);
    setPriceType(null);
    storage.clear();
  };

  return (
    <AuthContext.Provider value={{ contractor, contract, priceType, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
