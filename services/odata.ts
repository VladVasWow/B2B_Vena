import { getAuthHeader, IS_WEB, ODATA_URL } from '@/constants/api';

// --- Типи ---
export interface ODataList<T> {
  value: T[];
}

export interface Contractor {
  Ref_Key: string;
  Code: string;
  Description: string;
  НаименованиеПолное: string | null;
  КодПоЕДРПОУ: string | null;
  Телефоны: string | null;
  КонтрагентСайтаИД: string | null;
}

export interface Contract {
  Ref_Key: string;
  Code: string;
  Description: string;
  Owner_Key: string;
  ВидДоговора: string;
  ТипЦенПродажи_Key: string;
  ВалютаВзаиморасчетов_Key: string;
  ФормаОплаты: string;
  ОсновнойДоговор: boolean;
}

export interface PriceType {
  Ref_Key: string;
  Code: string;
  Description: string;
}

export interface Category {
  Ref_Key: string;
  Code: string;
  Description: string;
  Parent_Key: string;
  КорневаяКатегория_Key: string;
  ОсновноеИзображение_Key: string;
  ОсновноеИзображение?: { Ref_Key: string; Формат: string };
}

export interface Unit {
  Ref_Key: string;
  Description: string;
}

export interface ProductPrice {
  Номенклатура_Key: string;
  ЕдиницаИзмерения_Key: string;
  Цена: number;
}

export interface Product {
  Ref_Key: string;
  Code: string;
  Description: string;
  Артикул: string;
  ОсновноеИзображение?: { Ref_Key: string; Формат: string };
  Категория_Key: string;
}

// --- Базовий fetch ---
// ВАЖЛИВО: URLSearchParams кодує ' як %27, але 1С OData потребує guid'value' — буквальні лапки.
// Будуємо query вручну — НЕ через URLSearchParams, щоб $ не кодувався в %24
// і guid'value' не кодувався в guid%27value%27
function buildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

async function odataGet<T>(resource: string, params: Record<string, string> = {}): Promise<T> {
  let url: string;

  if (IS_WEB) {
    const query = buildQuery(params);
    url = `/api/proxy?path=${encodeURIComponent(resource)}&${query}`;
  } else {
    const query = buildQuery({ '$format': 'json', ...params });
    url = `${ODATA_URL}/${resource}?${query}`;
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!IS_WEB) {
    headers['Authorization'] = getAuthHeader();
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`OData помилка ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// --- API методи ---

const NULL_GUID = '00000000-0000-0000-0000-000000000000';

// Топ-рівень категорій (Parent_Key = null guid)
export async function getTopCategories(): Promise<Category[]> {
  const data = await odataGet<ODataList<Category>>('Catalog_КатегорииТоваров', {
    '$filter': `ИспользуетВебСайт eq true and Parent_Key eq guid'${NULL_GUID}'`,
    '$select': 'Ref_Key,Code,Description,Parent_Key,ОсновноеИзображение_Key,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
    '$expand': 'ОсновноеИзображение',
    '$orderby': 'Description',
    '$format': 'json',
  });
  return data.value;
}

// Всі категорії — фільтр по КорневаяКатегория_Key клієнтсайд (в OData викликає AUTOORDER)
export async function getAllCategories(): Promise<Category[]> {
  const data = await odataGet<ODataList<Category>>('Catalog_КатегорииТоваров', {
    '$select': 'Ref_Key,Code,Description,Parent_Key,КорневаяКатегория_Key,ОсновноеИзображение_Key,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
    '$expand': 'ОсновноеИзображение',
    '$orderby': 'Description',
    '$format': 'json',
  });
  return data.value;
}

export interface ProductsResult {
  items: Product[];
  hasMore: boolean;
}

// Товари по підкатегорії з пагінацією та загальною кількістю
export async function getProducts(categoryKey: string, page = 0, pageSize = 30): Promise<ProductsResult> {
  const data = await odataGet<ODataList<Product>>('Catalog_Номенклатура', {
    '$filter': `IsFolder eq false and DeletionMark eq false and ИспользуетВебСайт eq true and Категория_Key eq guid'${categoryKey}'`,
    '$select': 'Ref_Key,Code,Description,Артикул,Категория_Key,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
    '$expand': 'ОсновноеИзображение',
    '$top': String(pageSize + 1), // запитуємо +1 щоб визначити чи є наступна сторінка
    '$skip': String(page * pageSize),
    '$format': 'json',
  });
  const hasMore = data.value.length > pageSize;
  return {
    items: data.value.slice(0, pageSize),
    hasMore,
  };
}

// Ціни товарів з регістру ЦеныКомпании через SliceLast
// Condition використовує подвоєні одинарні лапки всередині рядка: guid''value''
export async function getProductPrices(
  productKeys: string[],
  priceTypeKey: string
): Promise<ProductPrice[]> {
  if (!productKeys.length || !priceTypeKey) return [];

  const prodFilter = productKeys.length === 1
    ? `Номенклатура_Key eq guid''${productKeys[0]}''`
    : `(${productKeys.map((k) => `Номенклатура_Key eq guid''${k}''`).join(' or ')})`;

  const condition = `ТипЦен_Key eq guid''${priceTypeKey}'' and ${prodFilter}`;
  const resource = `InformationRegister_ЦеныКомпании_RecordType/SliceLast(Period=datetime'2030-01-01T00:00:00',Condition='${condition}')`;

  const data = await odataGet<ODataList<ProductPrice>>(resource, {
    '$select': 'Номенклатура_Key,ЕдиницаИзмерения_Key,Цена',
    '$format': 'json',
  });

  return data.value.filter((p) => p.Цена > 0);
}

// Одиниці виміру по списку ключів
export async function getUnitsByKeys(keys: string[]): Promise<Unit[]> {
  if (!keys.length) return [];
  const filter = keys.map((k) => `Ref_Key eq guid'${k}'`).join(' or ');
  const data = await odataGet<ODataList<Unit>>('Catalog_ЕдиницыИзмерения', {
    '$filter': filter,
    '$select': 'Ref_Key,Description',
    '$format': 'json',
  });
  return data.value;
}

// Елементи головної сторінки з регістру відомостей
export interface HomePageItem {
  ТипДанных_Key: string;
  Элемент: string;
  Элемент_Type: string;
}

export async function getHomePageItems(): Promise<HomePageItem[]> {
  const data = await odataGet<ODataList<HomePageItem>>('InformationRegister_ЭлементыГлавнойСтраницыСайта', {
    '$select': 'ТипДанных_Key,Элемент,Элемент_Type',
    '$format': 'json',
  });
  return data.value;
}

// Категорії по списку Ref_Key
export async function getCategoriesByKeys(keys: string[]): Promise<Category[]> {
  if (!keys.length) return [];
  const filter = keys.map((k) => `Ref_Key eq guid'${k}'`).join(' or ');
  const data = await odataGet<ODataList<Category>>('Catalog_КатегорииТоваров', {
    '$filter': filter,
    '$select': 'Ref_Key,Code,Description,Parent_Key,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
    '$expand': 'ОсновноеИзображение',
    '$format': 'json',
  });
  return data.value;
}

// Товари по списку Ref_Key
export async function getProductsByKeys(keys: string[]): Promise<Product[]> {
  if (!keys.length) return [];
  const filter = keys.map((k) => `Ref_Key eq guid'${k}'`).join(' or ');
  const data = await odataGet<ODataList<Product>>('Catalog_Номенклатура', {
    '$filter': filter,
    '$select': 'Ref_Key,Code,Description,Артикул,Категория_Key,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
    '$expand': 'ОсновноеИзображение',
    '$format': 'json',
  });
  return data.value;
}

// Пошук товарів: 6 цифр → по Code, інше → по Description (startswith або substringof)
export async function searchProducts(query: string, page = 0, pageSize = 30, contains = false): Promise<ProductsResult> {
  const q = query.trim();
  const byCode = /^\d{6}$/.test(q);
  const textFilter = byCode
    ? `Code eq '${q}'`
    : contains
      ? `substringof('${q}', Description)`
      : `startswith(Description,'${q}')`;
  const filter = `IsFolder eq false and DeletionMark eq false and ИспользуетВебСайт eq true and (${textFilter})`;
  const data = await odataGet<ODataList<Product>>('Catalog_Номенклатура', {
    '$filter': filter,
    '$select': 'Ref_Key,Code,Description,Артикул,Категория_Key,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
    '$expand': 'ОсновноеИзображение',
    '$top': String(pageSize + 1),
    '$skip': String(page * pageSize),
    '$format': 'json',
  });
  const hasMore = data.value.length > pageSize;
  return {
    items: data.value.slice(0, pageSize),
    hasMore,
  };
}

// Тип цін по ключу
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export async function getPriceType(key: string): Promise<PriceType | null> {
  if (!key || key === EMPTY_GUID) return null;
  try {
    const data = await odataGet<PriceType>(`Catalog_ТипыЦен(guid'${key}')`, {
      '$select': 'Ref_Key,Code,Description',
      '$format': 'json',
    });
    return data;
  } catch {
    return null;
  }
}

// Основний договір контрагента
export async function getMainContract(contractorKey: string): Promise<Contract | null> {
  const data = await odataGet<ODataList<Contract>>('Catalog_ДоговорыВзаиморасчетов', {
    '$filter': `Owner_Key eq guid'${contractorKey}' and ОсновнойДоговор eq true and DeletionMark eq false`,
    '$select': 'Ref_Key,Code,Description,Owner_Key,ВидДоговора,ТипЦенПродажи_Key,ВалютаВзаиморасчетов_Key,ФормаОплаты,ОсновнойДоговор',
    '$top': '1',
    '$format': 'json',
  });
  return data.value[0] ?? null;
}

// Авторизація по телефону та ЄДРПОУ
// Телефон нормалізується до 10 цифр (без коду країни), шукається через substringof
export async function loginByPhoneAndEdrpou(phone: string, edrpou: string): Promise<Contractor | null> {
  // Нормалізація: залишаємо тільки цифри, беремо останні 10
  const digits = phone.replace(/\D/g, '');
  const phone10 = digits.slice(-10);
  if (phone10.length < 10) return null;

  const filter = `IsFolder eq false and DeletionMark eq false and КодПоЕДРПОУ eq '${edrpou.trim()}' and substringof('${phone10}', Телефоны)`;
  const data = await odataGet<ODataList<Contractor>>('Catalog_Контрагенты', {
    '$filter': filter,
    '$select': 'Ref_Key,Code,Description,НаименованиеПолное,КодПоЕДРПОУ,Телефоны,КонтрагентСайтаИД',
    '$top': '1',
    '$format': 'json',
  });
  return data.value[0] ?? null;
}
