import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let nextId = 0;

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []);

  const iconName =
    toast.type === 'success' ? 'checkmark-circle' :
    toast.type === 'error' ? 'alert-circle' : 'information-circle';

  const iconColor =
    toast.type === 'success' ? '#059669' :
    toast.type === 'error' ? '#EF4444' : '#2563EB';

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Ionicons name={iconName} size={18} color={iconColor} />
      <Text style={styles.toastText}>{toast.message}</Text>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.container} pointerEvents="none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 400,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
});
