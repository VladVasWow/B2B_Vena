import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginByPhoneAndEdrpou, getMainContract, getPriceType } from '@/services/odata';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [edrpou, setEdrpou] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Введіть коректний номер телефону');
      return;
    }
    if (edrpou.trim().length < 8) {
      setError('Введіть коректний код ЄДРПОУ');
      return;
    }

    setLoading(true);
    try {
      const contractor = await loginByPhoneAndEdrpou(phone, edrpou);
      if (!contractor) {
        setError('Контрагента не знайдено. Перевірте номер телефону та код ЄДРПОУ.');
        return;
      }
      const contract = await getMainContract(contractor.Ref_Key);
      if (!contract) {
        setError('Для вашого контрагента не знайдено основного договору. Зверніться до менеджера.');
        return;
      }
      const priceType = await getPriceType(contract.ТипЦенПродажи_Key);
      login(contractor, contract, priceType);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Помилка з\'єднання');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        {/* Лого */}
        <View style={styles.logoRow}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoLetter}>В</Text>
          </View>
          <Text style={styles.logoName}>
            Vena <Text style={styles.logoB2B}>B2B</Text>
          </Text>
        </View>

        <Text style={styles.title}>Вхід</Text>
        <Text style={styles.subtitle}>Введіть номер телефону та код ЄДРПОУ</Text>

        {/* Телефон */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Номер телефону</Text>
          <TextInput
            style={styles.input}
            placeholder="0XXXXXXXXX"
            placeholderTextColor="#94A3B8"
            value={phone}
            onChangeText={(t) => { setPhone(t.replace(/\D/g, '')); setError(null); }}
            keyboardType="number-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="next"
          />
        </View>

        {/* ЄДРПОУ */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Код ЄДРПОУ</Text>
          <TextInput
            style={styles.input}
            placeholder="XXXXXXXX"
            placeholderTextColor="#94A3B8"
            value={edrpou}
            onChangeText={(t) => { setEdrpou(t.replace(/\D/g, '')); setError(null); }}
            keyboardType="number-pad"
            returnKeyType="done"
            autoComplete="name"
            onSubmitEditing={handleLogin}
          />
        </View>

        {/* Помилка */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Кнопка */}
        <Pressable
          style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.85 }, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.loginBtnText}>Увійти</Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoLetter: { fontSize: 24, fontWeight: '800', color: '#FFFFFF' },
  logoName: { fontSize: 26, fontWeight: '700', color: '#0F172A' },
  logoB2B: { color: '#2563EB', fontWeight: '800' },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
  },

  error: {
    fontSize: 13,
    color: '#EF4444',
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    lineHeight: 18,
  },

  loginBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnDisabled: { backgroundColor: '#93C5FD' },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
