import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '@/contexts/CartContext';
import { useFavorites } from '@/contexts/FavoritesContext';

interface AppHeaderProps {
  showBack?: boolean;
  title?: string;
}

export function AppHeader({ showBack, title }: AppHeaderProps) {
  const router = useRouter();
  const { itemCount } = useCart();
  const { favoriteCount } = useFavorites();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      {/* Left: back or logo */}
      <View style={styles.left}>
        {showBack ? (
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color="#2563EB" />
            {title ? (
              <Text style={styles.backTitle} numberOfLines={1}>{title}</Text>
            ) : null}
          </Pressable>
        ) : (
          <View style={styles.logoRow}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoLetter}>В</Text>
            </View>
            <Text style={styles.logoName}>Vena <Text style={styles.logoB2B}>B2B</Text></Text>
          </View>
        )}
      </View>

      {/* Right: actions */}
      <View style={styles.actions}>
        <Pressable style={styles.iconBtn} onPress={() => router.push('/favorites')} hitSlop={8}>
          <Ionicons name="heart-outline" size={24} color="#475569" />
          {favoriteCount > 0 && (
            <View style={[styles.badge, styles.badgeRed]}>
              <Text style={styles.badgeText}>{favoriteCount > 99 ? '99+' : favoriteCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.iconBtn} onPress={() => router.push('/cart')} hitSlop={8}>
          <Ionicons name="cart-outline" size={24} color="#475569" />
          {itemCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{itemCount > 99 ? '99+' : itemCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.iconBtn} onPress={() => router.push('/(tabs)/profile')} hitSlop={8}>
          <Ionicons name="person-outline" size={24} color="#475569" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  left: {
    flex: 1,
    marginRight: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 4,
    flex: 1,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  logoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  logoB2B: {
    color: '#2563EB',
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeRed: { backgroundColor: '#EF4444' },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
