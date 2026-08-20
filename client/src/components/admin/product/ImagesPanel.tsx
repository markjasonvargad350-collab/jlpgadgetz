import { useState } from 'react';
import { ImageOff, Plus, Trash2 } from 'lucide-react';
import { addImage, deleteImage } from '../../../services/adminProducts';
import { ApiError } from '../../../services/http';
import { Field, Input } from '../ui/Field';
import { Spinner } from '../ui/Spinner';
import type { AdminImage } from '../../../types/admin';

/** Edit-mode image manager: a thumbnail grid with per-image delete plus an
 *  add-by-URL form. Placeholder URLs only (no copyrighted Apple imagery). */
export function ImagesPanel({
  productId,
  images,
  onChanged,
}: {
  productId: string;
  images: AdminImage[];
  onChanged: () => void;
}) {
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) {
      setError('Enter an image URL.');
      return;
    }
    setError(null);
    setAdding(true);
    try {
      await addImage(productId, { url: url.trim(), alt: alt.trim() || undefined });
      setUrl('');
      setAlt('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the image.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    setRemovingId(id);
    try {
      await deleteImage(id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the image.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="glass rounded-3xl p-6">
      <h3 className="font-display font-bold">Images</h3>
      <p className="mt-1 text-sm text-ink-soft">Use placeholder URLs (e.g. placehold.co). The first image is the cover.</p>

      {images.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-2xl bg-white/70 ring-1 ring-white/70">
              <img src={img.url} alt={img.alt ?? ''} className="h-full w-full object-cover" loading="lazy" />
              <button
                onClick={() => handleRemove(img.id)}
                disabled={removingId === img.id}
                aria-label="Remove image"
                className="absolute top-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-ink/55 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 disabled:opacity-100"
              >
                {removingId === img.id ? <Spinner size={14} tone="light" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid place-items-center rounded-2xl bg-white/40 py-10 text-center text-sm text-ink-soft">
          <ImageOff className="mb-2 text-ink-soft" size={24} />
          No images yet.
        </div>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Image URL" htmlFor="img-url">
            <Input id="img-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://placehold.co/800x800" />
          </Field>
        </div>
        <div className="sm:w-48">
          <Field label="Alt text" htmlFor="img-alt" hint="Optional.">
            <Input id="img-alt" value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Front view" />
          </Field>
        </div>
        <button
          type="submit"
          disabled={adding}
          className="flex items-center justify-center gap-1.5 rounded-full bg-white/70 px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-white/70 transition-colors hover:bg-white disabled:opacity-60"
        >
          {adding ? <Spinner size={15} /> : <Plus size={15} />} Add
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
    </div>
  );
}
