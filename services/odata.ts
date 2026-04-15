import { getAuthHeader, IS_WEB, ODATA_URL, ORGANIZATION_KEY } from '@/constants/api';

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
  Рассчитывается: boolean;
  БазовыйТипЦен_Key: string;
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
  ПроцентСкидкиНаценки?: number;
}

export interface Product {
  Ref_Key: string;
  Code: string;
  Description: string;
  Артикул: string;
  ОсновноеИзображение?: { Ref_Key: string; Формат: string };
  Категория_Key: string;
  СтавкаНДС?: string;
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

async function odataPost<T>(resource: string, body: Record<string, unknown>): Promise<T> {
  let url: string;

  if (IS_WEB) {
    url = `/api/proxy?path=${encodeURIComponent(resource)}`;
  } else {
    url = `${ODATA_URL}/${resource}?$format=json`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (!IS_WEB) {
    headers['Authorization'] = getAuthHeader();
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OData POST помилка ${response.status}: ${text.slice(0, 300)}`);
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
    '$select': 'Ref_Key,Code,Description,Артикул,Категория_Key,СтавкаНДС,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
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
async function fetchPriceSlice(productKeys: string[], typeKey: string): Promise<ProductPrice[]> {
  const prodFilter = productKeys.length === 1
    ? `Номенклатура_Key eq guid''${productKeys[0]}''`
    : `(${productKeys.map((k) => `Номенклатура_Key eq guid''${k}''`).join(' or ')})`;

  const condition = `ТипЦен_Key eq guid''${typeKey}'' and ${prodFilter}`;
  const resource = `InformationRegister_ЦеныКомпании_RecordType/SliceLast(Period=datetime'2030-01-01T00:00:00',Condition='${condition}')`;

  const data = await odataGet<ODataList<ProductPrice>>(resource, {
    '$select': 'Номенклатура_Key,ЕдиницаИзмерения_Key,Цена,ПроцентСкидкиНаценки',
    '$format': 'json',
  });
  return data.value;
}

// Якщо тип цін Рассчитывається:
//   1. Зріз по розрахунковому типу → Цена (ціна з типу цін)
//   2. Зріз по базовому типу → ПроцентСкидкиНаценки
//   3. Фінальна ціна = calc.Цена × (1 + base.ПроцентСкидкиНаценки / 100)
export async function getProductPrices(
  productKeys: string[],
  priceTypeKey: string,
  priceType?: PriceType | null
): Promise<ProductPrice[]> {
  if (!productKeys.length || !priceTypeKey) return [];

  if (priceType?.Рассчитывается && priceType.БазовыйТипЦен_Key !== NULL_GUID) {
    // VIP: Цена=0, ПроцентСкидкиНаценки=1
    // BASE: Цена=990, ПроцентСкидкиНаценки=0
    // Формула: finalPrice = base.Цена * (1 + calc.ПроцентСкидкиНаценки / 100)
    const [calcPrices, basePrices] = await Promise.all([
      fetchPriceSlice(productKeys, priceTypeKey),
      fetchPriceSlice(productKeys, priceType.БазовыйТипЦен_Key),
    ]);

    // calcMap: ключ Номенклатура+Одиниця → відсоток
    const calcMap = new Map(
      calcPrices.map((p) => [`${p.Номенклатура_Key}__${p.ЕдиницаИзмерения_Key}`, p.ПроцентСкидкиНаценки ?? 0])
    );

    // Ітеруємо по базових цінах (вони мають реальну Цена)
    return basePrices
      .filter((p) => p.Цена > 0)
      .map((p): ProductPrice => {
        const percent = calcMap.get(`${p.Номенклатура_Key}__${p.ЕдиницаИзмерения_Key}`) ?? 0;
        return {
          ...p,
          Цена: parseFloat((p.Цена * (1 + percent / 100)).toFixed(4)),
        };
      });
  }

  // Звичайний тип: один зріз
  const prices = await fetchPriceSlice(productKeys, priceTypeKey);
  return prices.filter((p) => p.Цена > 0);
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
    '$select': 'Ref_Key,Code,Description,Артикул,Категория_Key,СтавкаНДС,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
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
    '$select': 'Ref_Key,Code,Description,Артикул,Категория_Key,СтавкаНДС,ОсновноеИзображение/Ref_Key,ОсновноеИзображение/Формат',
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

// --- Характеристики товару (СвойстваКатегории) ---

export interface ProductProperty {
  Свойство_Key: string;
  Значение_Key: string;
}

export interface PropertyName {
  Ref_Key: string;
  Description: string;
}

export interface PropertyValue {
  Ref_Key: string;
  Description: string;
}

const CATALOG_NOM = 'Catalog_%D0%9D%D0%BE%D0%BC%D0%B5%D0%BD%D0%BA%D0%BB%D0%B0%D1%82%D1%83%D1%80%D0%B0';
const SVOISTVA_KATEGORII = '%D0%A1%D0%B2%D0%BE%D0%B9%D1%81%D1%82%D0%B2%D0%B0%D0%9A%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B8';

// Табличная часть СвойстваКатегории товару
export async function getProductProperties(productKey: string): Promise<ProductProperty[]> {
  const resource = `${CATALOG_NOM}(guid'${productKey}')/${SVOISTVA_KATEGORII}`;
  const data = await odataGet<ODataList<ProductProperty>>(resource, {
    '$select': 'Свойство_Key,Значение_Key',
    '$format': 'json',
  });
  return data.value.filter(
    (p) => p.Свойство_Key !== NULL_GUID && p.Значение_Key !== NULL_GUID
  );
}

// Назви характеристик із Catalog_СвойстваНоменклатуры
export async function getPropertyNames(keys: string[]): Promise<PropertyName[]> {
  if (!keys.length) return [];
  const filter = keys.map((k) => `Ref_Key eq guid'${k}'`).join(' or ');
  const data = await odataGet<ODataList<PropertyName>>(
    'Catalog_%D0%A1%D0%B2%D0%BE%D0%B9%D1%81%D1%82%D0%B2%D0%B0%D0%9D%D0%BE%D0%BC%D0%B5%D0%BD%D0%BA%D0%BB%D0%B0%D1%82%D1%83%D1%80%D1%8B',
    {
      '$filter': filter,
      '$select': 'Ref_Key,Description',
      '$format': 'json',
    }
  );
  return data.value;
}

// Значення характеристик із Catalog_ЗначенияСвойствНоменклатуры
export async function getPropertyValues(keys: string[]): Promise<PropertyValue[]> {
  if (!keys.length) return [];
  const filter = keys.map((k) => `Ref_Key eq guid'${k}'`).join(' or ');
  const data = await odataGet<ODataList<PropertyValue>>(
    'Catalog_%D0%97%D0%BD%D0%B0%D1%87%D0%B5%D0%BD%D0%B8%D1%8F%D0%A1%D0%B2%D0%BE%D0%B9%D1%81%D1%82%D0%B2%D0%9D%D0%BE%D0%BC%D0%B5%D0%BD%D0%BA%D0%BB%D0%B0%D1%82%D1%83%D1%80%D1%8B',
    {
      '$filter': filter,
      '$select': 'Ref_Key,Description',
      '$format': 'json',
    }
  );
  return data.value;
}

// Тип цін по ключу
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

export async function getPriceType(key: string): Promise<PriceType | null> {
  if (!key || key === EMPTY_GUID) return null;
  try {
    const data = await odataGet<PriceType>(`Catalog_ТипыЦен(guid'${key}')`, {
      '$select': 'Ref_Key,Code,Description,Рассчитывается,БазовыйТипЦен_Key',
      '$format': 'json',
    });
    return data;
  } catch {
    return null;
  }
}

// Ключ типу цін для запитів до реєстру
// Розрахункова логіка (Рассчитывается=true) тепер повністю всередині getProductPrices
export function effectivePriceTypeKey(priceType: PriceType | null): string {
  return priceType?.Ref_Key ?? '';
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

// --- Замовлення (Document_туКоммерческоеПредложение) ---

export interface Order {
  Ref_Key: string;
  Number: string;
  Date: string; // ISO datetime
  Posted: boolean;
  Утвержден: boolean;
  ЕстьЗаказПокупателя: boolean;
  ЕстьРасход: boolean;
  ЕстьСчет: boolean;
  СуммаДокумента: number;
  НомерЗаказа: string;
  Комментарий: string;
  Контрагент_Key: string;
  ДоговорВзаиморасчетов_Key: string;
  ВалютаДокумента_Key: string;
}

export interface OrderLine {
  LineNumber: string;
  Код: string;
  Номенклатура_Key: string;
  ЕдиницаИзмерения_Key: string;
  Количество: number;
  ЦенаСНДС: number;
  Сумма: number;
  СуммаНДС: number;
  СуммаСкидки: number;
  СтавкаНДС: string;
}

export interface OrdersResult {
  items: Order[];
  hasMore: boolean;
}

const ORDER_DOC = 'Document_%D1%82%D1%83%D0%9A%D0%BE%D0%BC%D0%BC%D0%B5%D1%80%D1%87%D0%B5%D1%81%D0%BA%D0%BE%D0%B5%D0%9F%D1%80%D0%B5%D0%B4%D0%BB%D0%BE%D0%B6%D0%B5%D0%BD%D0%B8%D0%B5';

export async function getOrders(
  contractorKey: string,
  contractKey: string,
  page = 0,
  pageSize = 20
): Promise<OrdersResult> {
  const filter = `DeletionMark eq false and Контрагент_Key eq guid'${contractorKey}' and ДоговорВзаиморасчетов_Key eq guid'${contractKey}'`;
  const data = await odataGet<ODataList<Order>>(ORDER_DOC, {
    '$filter': filter,
    '$select': 'Ref_Key,Number,Date,Posted,Утвержден,ЕстьЗаказПокупателя,ЕстьРасход,ЕстьСчет,СуммаДокумента,НомерЗаказа,Комментарий,Контрагент_Key,ДоговорВзаиморасчетов_Key',
    '$orderby': 'Date desc',
    '$top': String(pageSize + 1),
    '$skip': String(page * pageSize),
    '$format': 'json',
  });
  const hasMore = data.value.length > pageSize;
  return { items: data.value.slice(0, pageSize), hasMore };
}

export async function getOrderLines(orderKey: string): Promise<OrderLine[]> {
  const resource = `${ORDER_DOC}(guid'${orderKey}')/%D0%A2%D0%BE%D0%B2%D0%B0%D1%80%D1%8B`;
  const data = await odataGet<ODataList<OrderLine>>(resource, {
    '$select': 'LineNumber,Код,Номенклатура_Key,ЕдиницаИзмерения_Key,Количество,ЦенаСНДС,Сумма,СуммаНДС,СуммаСкидки,СтавкаНДС',
    '$format': 'json',
  });
  return data.value;
}

// --- Створення замовлення ---

export interface CreateOrderLine {
  productKey: string;
  unitKey: string;
  quantity: number;
  price: number;    // ЦенаСНДС — ціна з ПДВ з регістру цін
  vatRate: string;  // СтавкаНДС з номенклатури, напр. "НДС20", "НДС7", "БезНДС"
}

export interface CreateOrderParams {
  contractorKey: string;
  contractKey: string;
  priceTypeKey: string;
  currencyKey: string;
  comment?: string;
  items: CreateOrderLine[];
}

// Повертає коефіцієнт ПДВ за рядком ставки: "НДС20" → 0.20, "НДС7" → 0.07, інше → 0
function vatFactor(rate: string): number {
  if (rate === 'НДС20') return 0.20;
  if (rate === 'НДС7')  return 0.07;
  return 0;
}

export async function createOrder(params: CreateOrderParams): Promise<string> {
  const now = new Date().toISOString().replace('Z', '').slice(0, 19);

  const lines = params.items.map((item, idx) => {
    const factor = vatFactor(item.vatRate);
    const ценаСНДС   = item.price;                                            // ціна з ПДВ
    const цена       = parseFloat((ценаСНДС / (1 + factor)).toFixed(4));     // ціна без ПДВ
    const сумма      = parseFloat((цена * item.quantity).toFixed(2));        // сума без ПДВ
    const суммаНДС   = parseFloat((ценаСНДС * item.quantity - сумма).toFixed(2));
    return {
      LineNumber: idx + 1,
      Номенклатура_Key: item.productKey,
      ЕдиницаИзмерения_Key: item.unitKey,
      Количество: item.quantity,
      Коэффициент: 1,
      Цена: цена,
      ЦенаСНДС: ценаСНДС,
      ПроцентСкидкиНаценки: 0,
      СуммаБезСкидки: сумма,
      СуммаСкидки: 0,
      Сумма: сумма,
      СуммаНДС: суммаНДС,
      СтавкаНДС: item.vatRate,
    };
  });

  const суммаДокумента = parseFloat(
    lines.reduce((s, l) => s + l.Сумма, 0).toFixed(2)
  );

  const body: Record<string, unknown> = {
    Date: now,
    Организация_Key: ORGANIZATION_KEY,
    Контрагент_Key: params.contractorKey,
    ДоговорВзаиморасчетов_Key: params.contractKey,
    ТипЦен_Key: params.priceTypeKey,
    ВалютаДокумента_Key: params.currencyKey,
    КурсДокумента: 1,
    КратностьДокумента: 1,
    КурсВзаиморасчетов: 1,
    КратностьВзаиморасчетов: 1,
    УчитыватьНДС: true,
    СуммаВключаетНДС: false,
    СуммаДокумента: суммаДокумента,
    Комментарий: params.comment ?? '',
    Товары: lines,
  };

  const doc = await odataPost<{ Ref_Key: string }>(ORDER_DOC, body);
  if (!doc.Ref_Key) throw new Error('Документ створено, але Ref_Key не отримано');
  return doc.Ref_Key;
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
