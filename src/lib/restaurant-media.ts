export type MenuItem = {
  name: string;
  price: number;
  description: string;
  image: string;
};

export type PublicRestaurant = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  logo_url: string | null;
  facade_url: string | null;
  menu: MenuItem[];
};

export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  return `${base}/storage/v1/object/public/restaurant-media/${path}`;
}

export function parseMenu(value: unknown): MenuItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { name?: unknown; price?: unknown; description?: unknown; image?: unknown };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const price = Number(row.price);
    if (!name || !Number.isFinite(price)) return [];
    return [{
      name,
      price,
      description: typeof row.description === "string" ? row.description : "",
      image: typeof row.image === "string" ? row.image : "",
    }];
  });
}

type Heic2Any = (options: { blob: Blob; toType: string; quality: number }) => Promise<Blob | Blob[]>;

function isHeic(file: File, bytes: Uint8Array): boolean {
  const type = file.type.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) return true;
  if (/\.hei[cf]$/i.test(file.name)) return true;
  const head = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 32)));
  return head.includes("heic") || head.includes("heif") || head.includes("mif1") || head.includes("msf1");
}

function jpegFromSource(source: CanvasImageSource, width: number, height: number): string {
  if (!width || !height) throw new Error("No se pudo leer la foto");
  const scale = Math.min(1, 960 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la foto");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function jpegFromBlob(blob: Blob): Promise<string> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      try {
        return jpegFromSource(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    } catch {
      // Some phones reject createImageBitmap and still decode with an image element.
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la foto"));
    reader.readAsDataURL(blob);
  });
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("No se pudo leer la foto"));
    image.src = dataUrl;
  });
  return jpegFromSource(image, image.naturalWidth, image.naturalHeight);
}

let heicConverter: Promise<Heic2Any> | null = null;

function loadHeicConverter(): Promise<Heic2Any> {
  if (!heicConverter) {
    heicConverter = new Promise((resolve, reject) => {
      const ready = (window as Window & { heic2any?: Heic2Any }).heic2any;
      if (ready) return resolve(ready);
      const script = document.createElement("script");
      script.src = "/heic2any.js";
      script.async = true;
      script.onload = () => {
        const loaded = (window as Window & { heic2any?: Heic2Any }).heic2any;
        if (loaded) resolve(loaded);
        else reject(new Error("No se pudo convertir la foto del iPhone"));
      };
      script.onerror = () => reject(new Error("No se pudo convertir la foto del iPhone"));
      document.head.appendChild(script);
    });
  }
  return heicConverter;
}

export async function compressImage(file: File): Promise<string> {
  if (!file || file.size === 0) throw new Error("La foto llegó vacía. Elige otra.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let blob: Blob = new Blob([bytes], { type: file.type || "image/jpeg" });
  if (isHeic(file, bytes)) {
    const convert = await loadHeicConverter();
    const converted = await convert({ blob, toType: "image/jpeg", quality: 0.8 });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }
  return jpegFromBlob(blob);
}

export function whatsappOrderUrl(phone: string | null | undefined, name: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  const text = `Hola, quiero pedir en ${name}.`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}
