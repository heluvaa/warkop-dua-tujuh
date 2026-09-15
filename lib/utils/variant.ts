import type { MenuVariantConfig, SelectedVariant } from '../types';

// Apakah sebuah menu punya konfigurasi varian sama sekali (ukuran, level
// gula/es, atau topping) — dipakai untuk memutuskan apakah tap "Tambah" di
// Kasir perlu membuka dialog pilihan varian dulu, atau langsung masuk
// keranjang seperti menu biasa.
export function hasAnyVariantConfig(config?: MenuVariantConfig): boolean {
  if (!config) return false;
  return Boolean(
    (config.sizes && config.sizes.length > 0) ||
      (config.sugarIceLevels && config.sugarIceLevels.length > 0) ||
      (config.toppings && config.toppings.length > 0)
  );
}

// Total tambahan harga dari satu pilihan varian (ukuran + level gula/es +
// semua topping yang dipilih), belum dikali quantity.
export function computeVariantExtra(variant?: SelectedVariant): number {
  if (!variant) return 0;
  const sizeDelta = variant.size?.priceDelta ?? 0;
  const sugarIceDelta = variant.sugarIce?.priceDelta ?? 0;
  const toppingsTotal = (variant.toppings ?? []).reduce((sum, t) => sum + t.price, 0);
  return sizeDelta + sugarIceDelta + toppingsTotal;
}

// Label ringkas untuk ditampilkan di keranjang/struk/laporan, mis. "Large ·
// Less Sugar · Boba + Espresso Shot". undefined kalau tidak ada varian yang
// dipilih sama sekali.
export function formatSelectedVariantLabel(variant?: SelectedVariant): string | undefined {
  if (!variant) return undefined;
  const parts: string[] = [];
  if (variant.size) parts.push(variant.size.name);
  if (variant.sugarIce) parts.push(variant.sugarIce.name);
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
  const sugarIcePart = variant?.sugarIce?.name ?? '';
  const toppingsPart = (variant?.toppings ?? [])
    .map((t) => t.name)
    .sort()
    .join(',');
  return `${menuItemId}__${sizePart}__${sugarIcePart}__${toppingsPart}`;
}
