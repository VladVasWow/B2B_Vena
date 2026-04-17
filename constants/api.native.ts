import { Platform } from 'react-native';

// 📱 NATIVE (iOS/Android) version — credentials needed for direct API calls.
// Metro bundler uses this file instead of api.ts on mobile builds.
// This file is NOT included in the web bundle.
export const API_CONFIG = {
  BASE_URL: 'https://1csync.mailcn.com.ua:9443/VenaCentr',
  LOGIN: 'website',
  PASSWORD: 'ty4hD65G7T',
} as const;

// Ref_Key організації для нових документів (Catalog_Организации)
export const ORGANIZATION_KEY = 'd4970cf7-d21d-11d7-8892-00d0b721b194';

// На вебі — через Expo API Route (без CORS), на мобільному — напряму
export const IS_WEB = Platform.OS === 'web';

export const ODATA_URL = `${API_CONFIG.BASE_URL}/odata/standard.odata`;
export const HS_URL = `${API_CONFIG.BASE_URL}/hs`;

export function getAuthHeader(): string {
  const credentials = btoa(`${API_CONFIG.LOGIN}:${API_CONFIG.PASSWORD}`);
  return `Basic ${credentials}`;
}

export function getImageUrl(refKey?: string, format?: string): string | null {
  if (!refKey || !format) return null;
  return `http://img.vena.com.ua/web-storage/pict/${refKey}.${format}`;
}
