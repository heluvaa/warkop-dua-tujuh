import type { MenuVariantConfig, SelectedVariant } from '../types';

// Apakah sebuah menu punya konfigurasi varian sama sekali (ukuran, rasa,
// panas/dingin, atau topping) — dipakai untuk memutuskan apakah tap
// "Tambah" di Kasir perlu membuka dialog pilihan varian dulu, atau langsung
// masuk keranjang seperti menu biasa.
export function hasAnyVariantConfig(config?: MenuVariantConfig): boolean {
  if (!config) return false;
  return Boolean(
    (config.sizes && config.sizes.length > 0) ||
      (config.flavors && config.flavors.length > 0) ||
      (config.hotCold && config.hotCold.length > 0) ||
      (config.toppings && config.toppings.length > 0)
  );
}

// Total tambahan harga dari satu pilihan varian (ukuran + rasa +
// panas/dingin + semua topping yang dipilih), belum dikali quantity.
export function computeVariantExtra(variant?: SelectedVariant): number {
  if (!variant) return 0;
  const sizeDelta = variant.size?.priceDelta ?? 0;
  const flavorDelta = variant.flavor?.priceDelta ?? 0;
  const hotColdDelta = variant.hotCold?.priceDelta ?? 0;
  const toppingsTotal = (variant.toppings ?? []).reduce((sum, t) => sum + t.price, 0);
  return sizeDelta + flavorDelta + hotColdDelta + toppingsTotal;
}

// Label ringkas untuk ditampilkan di keranjang/struk/laporan, mis. "Large ·
// Caramel · Dingin · Boba + Espresso Shot". undefined kalau tidak ada
// varian yang dipilih sama sekali.
export function formatSelectedVariantLabel(variant?: SelectedVariant): string | undefined {
  if (!variant) return undefined;
  const parts: string[] = [];
  if (variant.size) parts.push(variant.size.name);
  if (variant.flavor) parts.push(variant.flavor.name);
  if (variant.hotCold) parts.push(variant.hotCold.name);
  if (variant.toppings && variant.toppings.length > 0) {
    parts.push(variant.toppings.map((t) => t.name).join(' + '));
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

// Id unik untuk satu baris keranjang, gabungan menuItemId + tanda tangan
// pilihan varian — supaya menu yang sama dengan varian berbeda jadi baris
// terpisah, tapi varian yang SAMA persis (mis. tap dua kali dengan pilihan
// identik) tetap digabung jadi satu baris dengan quantity bertambah.
export function buildCartLineId(menuItemId: string, variant?: SelectedVariant): string {
  const sizePart = variant?.size?.name ?? '';
  const flavorPart = variant?.flavor?.name ?? '';
  const hotColdPart = variant?.hotCold?.name ?? '';
  const toppingsPart = (variant?.toppings ?? [])
    .map((t) => t.name)
    .sort()
    .join(',');
  return `${menuItemId}__${sizePart}__${flavorPart}__${hotColdPart}__${toppingsPart}`;
}
