import { Product } from './odata';

const cache = new Map<string, Product>();

export function putProduct(product: Product) {
  cache.set(product.Ref_Key, product);
}

export function getProduct(key: string): Product | null {
  return cache.get(key) ?? null;
}
