import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseMenu, publicMediaUrl, type MenuItem, type PublicRestaurant } from "@/lib/restaurant-media";
import { RestaurantProfile } from "./PublicDirectory";

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
};

export function RestaurantMenuEditor() {
  const { user } = useAuth();
  const [row, setRow] = useState<RestaurantRow | null>(null);
  const [hours, setHours] = useState("");
  const [category, setCategory] = useState("Mexicana");
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("restaurants")
      .select("id,name,category,address,phone,hours,logo_url,facade_url,menu")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) return;
    setRow(data as RestaurantRow);
    setHours(data.hours ?? "");
    setCategory(data.category || "Mexicana");
    setMenu(parseMenu(data.menu));
  };

  useEffect(() => { load(); }, [user?.id]);

  const upload = async (file: File, kind: "logo" | "facade") => {
    if (!user || !row) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("La imagen no debe pesar más de 8MB");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    setBusy(true);
    const { error } = await supabase.storage.from("restaurant-media").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const patch = kind === "logo" ? { logo_url: path } : { facade_url: path };
    const { error: saveError } = await supabase.from("restaurants").update(patch).eq("id", row.id);
    setBusy(false);
    if (saveError) return toast.error(saveError.message);
    toast.success(kind === "logo" ? "Logo guardado" : "Foto guardada");
    load();
  };

  const uploadDish = async (index: number, file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("La imagen no debe pesar más de 8MB");
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/dish-${Date.now()}.${ext}`;
    setBusy(true);
    const { error } = await supabase.storage.from("restaurant-media").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setMenu((current) => current.map((item, i) => i === index ? { ...item, image: path } : item));
    toast.success("Foto del platillo lista. Pulsa Guardar menú.");
  };

  const saveMenu = async () => {
    if (!row) return;
    const clean = menu.filter((item) => item.name.trim());
    setBusy(true);
    const { error } = await supabase.from("restaurants").update({
      hours: hours.trim() || null,
      category,
      menu: clean as never,
    }).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Menú guardado");
    load();
  };

  if (!row) return null;

  return (
    <section className="rounded-2xl border border-hairline bg-paper p-4">
      <h2 className="text-lg font-semibold">Tu página pública</h2>
      <p className="mt-1 text-sm text-graphite">Logo, foto del local y platillos que ve el cliente.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ImageField label="Logo" src={publicMediaUrl(row.logo_url)} busy={busy} onFile={(file) => upload(file, "logo")} />
        <ImageField label="Foto del local" src={publicMediaUrl(row.facade_url)} busy={busy} onFile={(file) => upload(file, "facade")} />
      </div>
      <div className="mt-4">
        <Label>Categoría</Label>
        <select className="mt-1 h-11 w-full rounded-xl border border-hairline bg-white px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
          {["Mariscos", "Mexicana", "Tacos", "Hamburguesas", "Cafetería", "Pizza", "Sushi"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
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
      <Button className="mt-4 h-12 w-full" disabled={busy} onClick={saveMenu}>Guardar menú</Button>
      <div className="mt-6">
        <RestaurantProfile preview place={previewPlace(row, hours, category, menu)} />
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
