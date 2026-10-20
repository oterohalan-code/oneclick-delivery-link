import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { compressImage, parseMenu, publicMediaUrl, type MenuItem, type PublicRestaurant } from "@/lib/restaurant-media";
import { RestaurantProfile } from "./PublicDirectory";
import { parseGoogleMapsLink } from "@/lib/maps";

type RestaurantRow = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  logo_url: string | null;
  facade_url: string | null;
  menu: unknown;
  maps_url: string | null;
};

export function RestaurantMenuEditor() {
  const { user } = useAuth();
  const [row, setRow] = useState<RestaurantRow | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [category, setCategory] = useState("Mexicana");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("restaurants")
      .select("id,name,category,address,phone,hours,logo_url,facade_url,menu,maps_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return toast.error("No se pudieron cargar los datos del negocio");
    if (!data) return;
    setRow(data as RestaurantRow);
    setName(data.name ?? "");
    setAddress(data.address ?? "");
    setPhone(data.phone ?? "");
    setHours(data.hours ?? "");
    setMapsUrl(data.maps_url ?? "");
    setCategory(data.category || "Mexicana");
    setMenu(parseMenu(data.menu));
  };

  useEffect(() => { load(); }, [user?.id]);

  const upload = async (file: File, kind: "logo" | "facade") => {
    if (!user || !row) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("La imagen no debe pesar más de 8MB");
    setBusy(true);
    try {
      const image = await compressImage(file);
      const patch = kind === "logo" ? { logo_url: image } : { facade_url: image };
      const { error } = await supabase.from("restaurants").update(patch).eq("id", row.id);
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success(kind === "logo" ? "Logo guardado" : "Foto guardada");
      load();
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la foto");
    }
  };

  const uploadDish = async (index: number, file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("La imagen no debe pesar más de 8MB");
    setBusy(true);
    try {
      const image = await compressImage(file);
      setMenu((current) => current.map((item, i) => i === index ? { ...item, image } : item));
      setBusy(false);
      toast.success("Foto del platillo lista. Pulsa Guardar menú.");
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la foto");
    }
  };

  const saveMenu = async () => {
    if (!row || !user) return;
    if (!name.trim()) return toast.error("Escribe el nombre del negocio");
    if (!address.trim()) return toast.error("Escribe la dirección del negocio");
    if (!phone.trim()) return toast.error("Escribe el teléfono del negocio");
    const clean = menu.filter((item) => item.name.trim());
    const link = mapsUrl.trim();
    const parsedLink = link ? parseGoogleMapsLink(link) : null;
    if (link && !parsedLink) return toast.error("La liga de Google Maps del negocio no es válida");
    setBusy(true);
    const { data, error } = await supabase.from("restaurants").update({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      maps_url: link || null,
      ...(parsedLink?.lat != null && parsedLink?.lng != null ? { lat: parsedLink.lat, lng: parsedLink.lng } : {}),
      hours: hours.trim() || null,
      category,
      menu: clean as never,
    }).eq("id", row.id).eq("user_id", user.id).select("id").maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("No se pudieron guardar los datos del negocio");
    await load();
    toast.success("Datos del negocio y menú guardados");
  };

  if (!row) return null;

  return (
    <section className="rounded-2xl border border-hairline bg-paper p-4">
      <h2 className="text-lg font-semibold">Tu página pública</h2>
      <p className="mt-1 text-sm text-graphite">Logo, foto del local y platillos que ve el cliente.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="restaurant-name">Nombre del negocio</Label>
          <Input id="restaurant-name" className="mt-1" value={name} disabled={busy} autoComplete="organization" onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="restaurant-address">Dirección del negocio</Label>
          <Input id="restaurant-address" className="mt-1" value={address} disabled={busy} autoComplete="street-address" placeholder="Calle, número, colonia, Manzanillo, Colima" onChange={(event) => setAddress(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="restaurant-phone">Teléfono del negocio</Label>
          <Input id="restaurant-phone" className="mt-1" type="tel" value={phone} disabled={busy} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ImageField label="Logo" src={publicMediaUrl(row.logo_url)} busy={busy} onFile={(file) => upload(file, "logo")} />
        <ImageField label="Foto del local" src={publicMediaUrl(row.facade_url)} busy={busy} onFile={(file) => upload(file, "facade")} />
      </div>
      <div className="mt-4">
        <Label>Categoría</Label>
        <select className="mt-1 h-11 w-full rounded-xl border border-hairline bg-card px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
          {["Mariscos", "Mexicana", "Tacos", "Hamburguesas", "Cafetería", "Pizza", "Sushi"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="mt-4">
        <Label>Liga de Google Maps de tu negocio</Label>
        <Input className="mt-1" value={mapsUrl} placeholder="https://maps.app.goo.gl/..." onChange={(event) => setMapsUrl(event.target.value)} />
        <p className="mt-1 text-xs text-graphite">Se guarda una sola vez y se manda sola al repartidor en cada pedido.</p>
      </div>
      <div className="mt-4">
        <Label>Horario</Label>
        <Input className="mt-1" value={hours} placeholder="Lun a Dom 10:00–22:00" onChange={(event) => setHours(event.target.value)} />
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Menú</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setMenu([...menu, { name: "", price: 0, description: "", image: "" }])}>
            Agregar platillo
          </Button>
        </div>
        {menu.length === 0 && <p className="text-sm text-graphite">Todavía no hay platillos.</p>}
        {menu.map((item, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-hairline p-3">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bone">
                {publicMediaUrl(item.image) && <img src={publicMediaUrl(item.image) ?? ""} alt="" className="h-full w-full object-cover" />}
              </div>
              <label className="text-sm text-graphite">
                Foto del platillo
                <input
                  className="mt-1 block w-full text-sm"
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadDish(index, file);
                  }}
                />
              </label>
            </div>
            <Input
              placeholder="Tacos de pescado"
              value={item.name}
              onChange={(event) => setMenu(menu.map((rowItem, i) => i === index ? { ...rowItem, name: event.target.value } : rowItem))}
            />
            <div className="grid grid-cols-[120px_1fr_auto] gap-2">
              <Input
                type="number"
                min="0"
                placeholder="120"
                value={item.price || ""}
                onChange={(event) => setMenu(menu.map((rowItem, i) => i === index ? { ...rowItem, price: Number(event.target.value) } : rowItem))}
              />
              <Input
                placeholder="Descripción corta"
                value={item.description}
                onChange={(event) => setMenu(menu.map((rowItem, i) => i === index ? { ...rowItem, description: event.target.value } : rowItem))}
              />
              <Button type="button" variant="outline" onClick={() => setMenu(menu.filter((_, i) => i !== index))}>Quitar</Button>
            </div>
          </div>
        ))}
      </div>
      <Button className="mt-4 h-12 w-full" disabled={busy} onClick={saveMenu}>{busy ? "Guardando…" : "Guardar datos y menú"}</Button>
      <div className="mt-6">
        <RestaurantProfile preview place={previewPlace({ ...row, name, address, phone }, hours, category, menu)} />
      </div>
    </section>
  );
}

function previewPlace(row: RestaurantRow, hours: string, category: string, menu: MenuItem[]): PublicRestaurant {
  return {
    id: row.id,
    name: row.name,
    category,
    address: row.address,
    phone: row.phone,
    hours: hours.trim() || row.hours,
    logo_url: row.logo_url,
    facade_url: row.facade_url,
    menu: menu.filter((item) => item.name.trim()),
  };
}

function ImageField({ label, src, busy, onFile }: {
  label: string;
  src: string | null;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-hairline bg-bone">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="text-sm text-graphite">Subir imagen</span>}
      </div>
      <input
        className="mt-2 block w-full text-sm"
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </label>
  );
}
