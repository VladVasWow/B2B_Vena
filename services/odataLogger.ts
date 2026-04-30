import { Platform } from 'react-native';

export interface ODataLogEntry {
  id: string;
  ts: number;           // Date.now()
  method: string;       // GET / POST / PATCH
  resource: string;     // Catalog_Номенклатура etc.
  description: string;  // авто-опис
  fullUrl: string;      // повний URL запиту (для копіювання)
  status: number;
  durationMs: number;
  sizeBytes: number;
}

const MAX_ENTRIES = 50;
const STORAGE_KEY = 'odata_log';

// Авто-описи для відомих ресурсів
const RESOURCE_LABELS: Record<string, string> = {
  'Catalog_Номенклатура':                             'Товари',
  'Catalog_КатегорииТоваров':                         'Категорії',
  'Catalog_ХранилищеДополнительнойИнформации':        'Зображення',
  'Catalog_ЕдиницыИзмерения':                         'Одиниці',
  'Catalog_Контрагенты':                              'Контрагенти',
  'Catalog_ДоговорыКонтрагентов':                     'Договори',
  'Catalog_ТипыЦен':                                  'Типи цін',
  'InformationRegister_ЦеныКомпании':                 'Ціни',
  'InformationRegister_ЗначенияСвойствОбъектов':      'Властивості',
  'ChartOfCharacteristicTypes_СвойстваОбъектов':      'Назви властивостей',
  'Catalog_ЗначенияСвойствОбъектов':                  'Значення властивостей',
  'InformationRegister_ЭлементыГлавнойСтраницыСайта': 'Головна сторінка',
};

function describeResource(resource: string, params: Record<string, string>): string {
  // Декодуємо URL-encoded назву (Document_%D1%82%D1%83...)
  let decoded = resource;
  try { decoded = decodeURIComponent(resource); } catch {}

  // Прибираємо (guid'...') і все після нього для пошуку label
  const baseName = decoded.replace(/\(guid'[^']*'\).*$/, '').replace(/\/SliceLast\(.*$/, '');
  const label = Object.entries(RESOURCE_LABELS).find(([k]) => baseName.includes(k))?.[1]
    ?? baseName.replace(/^(Catalog_|Document_|InformationRegister_|ChartOfCharacteristicTypes_)/, '');

  // Витягуємо табличну частину після (guid'...')/
  const navMatch = decoded.match(/\(guid'[^']+'\)\/(.+)$/);
  const DOC_SUBTABLES: Record<string, string> = {
    'Товары': 'Товари', 'Услуги': 'Послуги', 'МатериалыЗаказчика': 'Матеріали',
  };
  const nav = navMatch
    ? ` / ${DOC_SUBTABLES[navMatch[1]] ?? navMatch[1]}`
    : '';

  const extras: string[] = [];
  if (params['$top'])  extras.push(`top=${params['$top']}`);
  if (params['$skip'] && params['$skip'] !== '0') extras.push(`skip=${params['$skip']}`);
  if (params['$inlinecount']) extras.push('count');
  const suffix = extras.length ? ` (${extras.join(', ')})` : '';
  return `${label}${nav}${suffix}`;
}


// --- In-memory store (синхронізований з localStorage на вебі) ---
let _entries: ODataLogEntry[] = [];

function load() {
  if (Platform.OS !== 'web') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Відфільтровуємо старі записи без fullUrl (несумісний формат)
      _entries = parsed.filter((e: ODataLogEntry) => typeof e.fullUrl === 'string');
    }
  } catch {}
}

function save() {
  if (Platform.OS !== 'web') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_entries)); } catch {}
}

load();

export function addLogEntry(entry: Omit<ODataLogEntry, 'id'>): void {
  const full: ODataLogEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...entry };
  _entries.unshift(full);
  if (_entries.length > MAX_ENTRIES) _entries = _entries.slice(0, MAX_ENTRIES);
  save();
}

export function getLogEntries(): ODataLogEntry[] {
  return [..._entries];
}

export function clearLog(): void {
  _entries = [];
  save();
}

export { describeResource };
