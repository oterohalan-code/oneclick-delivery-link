import { useNavigate } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "restaurant", label: "Restaurante" },
  { value: "courier", label: "Repartidor" },
];

export function RoleSwitcher() {
  const { role, isAdmin, setActingRole } = useAuth();
  const navigate = useNavigate();
  if (!isAdmin || !role) return null;

  return (
    <Select
      value={role}
      onValueChange={async (value) => {
        const next = value as AppRole;
        const res = await setActingRole(next);
        if (!res.ok) return toast.error(res.message ?? "No se pudo cambiar de panel.");
        navigate({ to: "/app" });
      }}
    >
      <SelectTrigger className="h-8 w-[148px] rounded-full text-xs font-semibold uppercase tracking-wider">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
