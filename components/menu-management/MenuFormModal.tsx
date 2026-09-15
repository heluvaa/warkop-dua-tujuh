'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { MenuItem } from '@/lib/types';
import { formatRupiah } from '@/lib/utils/format';

interface MenuFormData {
  name: string;
  price: number;
  hpp: number;
  category: string;
  stock: number;
  imageUrl?: string;
}

// Foto disimpan sebagai data URL langsung di localStorage (belum ada
// backend/storage terpisah — lihat catatan di lib/storage/db.ts), jadi
// dikompres & di-resize dulu di browser supaya tidak menghabiskan kuota
// localStorage (~5-10MB per origin) walau ditambahkan banyak menu.
const MAX_IMAGE_DIMENSION = 480;
const IMAGE_JPEG_QUALITY = 0.72;

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak didukung'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const NEW_CATEGORY_VALUE = '__new__';

export default function MenuFormModal({
  initial,
  existingCategories,
  onClose,
  onSave,
}: {
  initial?: MenuItem | null;
  existingCategories: string[];
  onClose: () => void;
  onSave: (data: MenuFormData) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [hpp, setHpp] = useState(initial?.hpp ? String(initial.hpp) : '');
  const [stock, setStock] = useState(initial ? String(initial.stock) : '');
  const [imageUrl, setImageUrl] = useState<string | undefined>(initial?.imageUrl);
  const [imageError, setImageError] = useState<string | null>(null);

  // Kategori: dropdown dari kategori yang sudah ada + opsi "Tambah kategori
  // baru" yang membuka input teks bebas. Kalau belum ada kategori sama
  // sekali (menu pertama), langsung tampilkan input teks.
  const hasExistingCategories = existingCategories.length > 0;
  const [isNewCategory, setIsNewCategory] = useState(
    !hasExistingCategories || (initial ? !existingCategories.includes(initial.category) : false)
  );
  const [category, setCategory] = useState(
    initial?.category ?? (hasExistingCategories ? existingCategories[0] : '')
  );

  const isValid =
    name.trim().length > 0 && Number(price) > 0 && category.trim().length > 0 && stock.length > 0;

  // Pratinjau margin — HPP boleh dikosongkan (dianggap 0) supaya menu lama
  // yang belum diisi HPP-nya tidak diblokir menyimpan perubahan lain.
  const priceNum = Number(price) || 0;
  const hppNum = Number(hpp) || 0;
  const marginValue = priceNum - hppNum;
  const marginPercent = priceNum > 0 ? (marginValue / priceNum) * 100 : 0;
  const hasHpp = hpp.trim().length > 0;

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // supaya bisa pilih file yang sama lagi kalau mau ganti
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('File harus berupa gambar.');
      return;
    }
    setImageError(null);
    try {
      const compressed = await compressImageFile(file);
      setImageUrl(compressed);
    } catch {
      setImageError('Gagal memproses gambar, coba foto lain.');
    }
  }

  function handleSubmit() {
    if (!isValid) return;
    onSave({
      name: name.trim(),
      price: Number(price),
      hpp: hppNum,
      category: category.trim(),
      stock: Number(stock),
      imageUrl,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-cream w-full sm:max-w-sm rounded-t-2xl sm:rounded-card p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-lg text-espresso">
            {initial ? 'Ubah Menu' : 'Tambah Menu'}
          </h2>
          <button onClick={onClose}>
            <X size={20} className="text-espresso/60" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-espresso/60">Nama Menu</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kopi Susu"
              className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
            />
          </div>
          <div>
            <label className="text-xs text-espresso/60">Foto Menu (opsional)</label>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-16 h-16 rounded-card bg-cream-dark/60 border border-cream-dark overflow-hidden shrink-0 flex items-center justify-center">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="Pratinjau foto menu" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-espresso/30 text-center px-1">Tanpa foto</span>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-espresso bg-surface border border-cream-dark rounded-card px-3 py-2 text-center cursor-pointer">
                  {imageUrl ? 'Ganti Foto' : 'Pilih Foto'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    className="text-[11px] text-brick"
                  >
                    Hapus foto
                  </button>
                )}
              </div>
            </div>
            {imageError && <p className="text-[11px] text-brick mt-1">{imageError}</p>}
          </div>
          <div>
            <label className="text-xs text-espresso/60">Kategori</label>
            {isNewCategory ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  autoFocus
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Contoh: Kopi"
                  className="flex-1 border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso focus:outline-none focus:border-espresso"
                />
                {hasExistingCategories && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewCategory(false);
                      setCategory(initial?.category && existingCategories.includes(initial.category) ? initial.category : existingCategories[0]);
                    }}
                    className="shrink-0 text-xs text-espresso/60 px-3 py-2.5"
                  >
                    Batal
                  </button>
                )}
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === NEW_CATEGORY_VALUE) {
                    setIsNewCategory(true);
                    setCategory('');
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
              >
                {existingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={NEW_CATEGORY_VALUE}>+ Tambah kategori baru</option>
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-espresso/60">Harga Jual</label>
              <input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
                placeholder="10000"
                className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
              />
            </div>
            <div>
              <label className="text-xs text-espresso/60">Stok</label>
              <input
                inputMode="numeric"
                value={stock}
                onChange={(e) => setStock(e.target.value.replace(/\D/g, ''))}
                placeholder="20"
                className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-espresso/60">HPP / Modal per porsi (opsional)</label>
            <input
              inputMode="numeric"
              value={hpp}
              onChange={(e) => setHpp(e.target.value.replace(/\D/g, ''))}
              placeholder="Contoh: 3000"
              className="w-full border border-cream-dark rounded-card px-4 py-2.5 bg-surface text-espresso mt-1 focus:outline-none focus:border-espresso"
            />
            <p className="text-[11px] text-espresso/40 mt-1">
              Total biaya bahan baku untuk membuat 1 porsi menu ini. Dipakai untuk menghitung
              untung bersih per menu di halaman Laporan.
            </p>
          </div>

          {priceNum > 0 && (
            <div
              className={`rounded-card p-3 border text-sm flex items-center justify-between ${
                marginValue < 0
                  ? 'bg-brick/10 border-brick/30 text-brick'
                  : 'bg-sage/10 border-sage/30 text-espresso'
              }`}
            >
              <span className="text-xs">
                {hasHpp ? 'Margin per porsi' : 'Margin (HPP belum diisi, dianggap 0)'}
              </span>
              <span className="font-semibold">
                {formatRupiah(marginValue)} ({marginPercent.toFixed(0)}%)
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full bg-espresso text-cream rounded-card py-3 font-medium disabled:opacity-40"
        >
          Simpan
        </button>
      </div>
    </div>
  );
}

