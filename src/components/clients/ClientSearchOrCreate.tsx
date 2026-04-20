import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search } from "lucide-react";
import { toast } from "sonner";

export interface ClientSearchOrCreateProps {
  /** Currently selected client id (controlled). */
  value: string | null;
  /** Called whenever the selected client changes (either picked or just-created). */
  onChange: (clientId: string | null, clientName: string) => void;
  /** Optional label override. */
  label?: string;
  /** Whether the field is required (visual asterisk). */
  required?: boolean;
}

/**
 * Reusable client picker:
 * - Searches the `clients` table by name/phone.
 * - When no results match the typed query, offers an inline
 *   "+ Crear cliente '<text>'" option that expands a small form.
 * - On submit creates the client and selects it automatically.
 */
export function ClientSearchOrCreate({
  value,
  onChange,
  label = "Cliente",
  required,
}: ClientSearchOrCreateProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Reset internal state when the consumer clears the value externally.
  useEffect(() => {
    if (!value) {
      setSelectedName("");
    }
  }, [value]);

  const { data: results } = useQuery({
    queryKey: ["client-search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone")
        .or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: search.trim().length >= 2 && !value && !showForm,
  });

  const createClient = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error("El nombre es obligatorio");
      }
      const { data, error } = await supabase
        .from("clients")
        .insert({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-list"] });
      queryClient.invalidateQueries({ queryKey: ["client-search"] });
      toast.success("Cliente creado correctamente");
      setShowForm(false);
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
      setSearch("");
      setSelectedName(client.name);
      onChange(client.id, client.name);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Selected state
  if (value) {
    return (
      <div className="space-y-2">
        <Label>{label}{required && " *"}</Label>
        <div className="flex items-center justify-between bg-card border rounded-md px-3 py-2">
          <span className="text-sm font-medium">{selectedName}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null, "");
              setSelectedName("");
              setSearch("");
            }}
          >
            Cambiar
          </Button>
        </div>
      </div>
    );
  }

  // Inline new-client form
  if (showForm) {
    return (
      <div className="space-y-2">
        <Label>{label}{required && " *"}</Label>
        <div className="space-y-3 border rounded-md p-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Nuevo cliente</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setName("");
                setPhone("");
                setEmail("");
                setNotes("");
              }}
            >
              Cancelar
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com (opcional)" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones..." rows={2} />
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={createClient.isPending || !name.trim()}
            onClick={() => createClient.mutate()}
          >
            {createClient.isPending ? "Guardando..." : "Guardar cliente"}
          </Button>
        </div>
      </div>
    );
  }

  // Search state
  return (
    <div className="space-y-2">
      <Label>{label}{required && " *"}</Label>
      <div className="space-y-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {results && results.length > 0 && (
          <div className="border rounded-md max-h-40 overflow-y-auto bg-popover">
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={() => {
                  setSelectedName(c.name);
                  setSearch("");
                  onChange(c.id, c.name);
                }}
              >
                <span className="font-medium">{c.name}</span>
                {c.phone && <span className="text-muted-foreground ml-2">· {c.phone}</span>}
              </button>
            ))}
          </div>
        )}
        {search.trim().length >= 2 && (!results || results.length === 0) && (
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm border rounded-md bg-popover hover:bg-muted transition-colors text-primary font-medium"
            onClick={() => {
              setName(search.trim());
              setShowForm(true);
            }}
          >
            + Crear cliente "{search.trim()}"
          </button>
        )}
      </div>
    </div>
  );
}
