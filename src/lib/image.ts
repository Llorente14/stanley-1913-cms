// Compress an uploaded image to WebP (max 400px) so it fits the localStorage quota.
export async function compressImage(file: File, max = 400, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 8 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Gambar tidak bisa dibaca.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/webp', quality);
    return out.startsWith('data:image/webp') ? out : c.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
