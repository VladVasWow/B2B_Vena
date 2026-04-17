import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CartProvider } from '@/contexts/CartContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';

const MAX_WIDTH = 1600;

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#E2E8F0', // видно тільки якщо екран ширший за MAX_WIDTH
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_WIDTH,
    overflow: 'hidden',
  },
});

export const unstable_settings = {
  anchor: '(tabs)',
};

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { contractor, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const onLoginScreen = segments[0] === 'login';
    if (!contractor && !onLoginScreen) {
      router.replace('/login');
    } else if (contractor && onLoginScreen) {
      router.replace('/(tabs)');
    }
  }, [contractor, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <ToastProvider>
            <View style={styles.outer}>
              <View style={styles.inner}>
                <AuthGuard>
                  <Stack>
                    <Stack.Screen name="login" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  </Stack>
                </AuthGuard>
                <StatusBar style="dark" />
              </View>
            </View>
          </ToastProvider>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  );
}
