import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { useAuth } from '@/contexts/AuthContext';

const CONTRACT_TYPES: Record<string, string> = {
  СПокупателем: 'З покупцем',
  СПоставщиком: 'З постачальником',
  Прочее: 'Інше',
};
const PAYMENT_FORMS: Record<string, string> = {
  Безналичный: 'Безготівковий',
  Наличный: 'Готівковий',
  Смешанный: 'Змішаний',
};
const contractTypeLabel = (v: string) => CONTRACT_TYPES[v] ?? v;
const paymentFormLabel = (v: string) => PAYMENT_FORMS[v] ?? v;

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { contractor, contract, priceType, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Профіль" />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {contractor?.Description?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.avatarInfo}>
            <Text style={styles.companyName} numberOfLines={2}>
              {contractor?.НаименованиеПолное || contractor?.Description}
            </Text>
            <Text style={styles.companyCode}>Код: {contractor?.Code}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow label="ЄДРПОУ" value={contractor?.КодПоЕДРПОУ} />
          <InfoRow label="Телефони" value={contractor?.Телефоны} />
          {contractor?.КонтрагентСайтаИД && (
            <InfoRow label="ID сайту" value={contractor.КонтрагентСайтаИД} />
          )}
        </View>

        {contract && (
          <>
            <Text style={styles.sectionLabel}>Основний договір</Text>
            <View style={styles.card}>
              {contract.Description ? (
                <InfoRow label="Назва" value={contract.Description} />
              ) : null}
              <InfoRow label="Код" value={contract.Code} />
              <InfoRow label="Вид договору" value={contractTypeLabel(contract.ВидДоговора)} />
              <InfoRow label="Форма оплати" value={paymentFormLabel(contract.ФормаОплаты)} />
              {priceType && <InfoRow label="Тип цін" value={priceType.Description} />}
            </View>
          </>
        )}

        <Pressable style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]} onPress={handleLogout}>
          <Text style={styles.logoutText}>Вийти</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 16 },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarLetter: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  avatarInfo: { flex: 1 },
  companyName: { fontSize: 16, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  companyCode: { fontSize: 12, color: '#94A3B8', marginTop: 4 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  infoLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#1E293B', fontWeight: '600', textAlign: 'right', flex: 1 },

  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4,
  },

  logoutBtn: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});
