import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';

export default function OrdersScreen() {
  return (
    <View style={styles.container}>
      <AppHeader title="Замовлення" />
      <View style={styles.empty}>
        <Ionicons name="receipt-outline" size={56} color="#CBD5E1" />
        <Text style={styles.emptyText}>Замовлень поки немає</Text>
        <Text style={styles.emptyHint}>Тут будуть відображатися ваші замовлення</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#334155' },
  emptyHint: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 32 },
});
