import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SESSION_TYPE_COLORS, STATUS_LABELS, STATUS_COLORS, AppointmentType, AppointmentStatus } from "@/lib/agenda-constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface AppointmentDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    start_time: string;
    end_time: string;
    type: AppointmentType;
    status: AppointmentStatus;
    notes: string | null;
    package_id: string | null;
    client_id: string;
    clients: { name: string } | null;
    professionals: { name: string; type: string } | null;
  } | null;
}

export function AppointmentDetailPanel({ open, onOpenChange, appointment }: AppointmentDetailPanelProps) {
  const queryClient = useQueryClient();
  const [noShowDialog, setNoShowDialog] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async (newStatus: AppointmentStatus) => {
      if (!appointment) return;
      // Revenue & package side-effects are handled by the DB trigger
      // `handle_revenue_on_session_done` when status changes to 'done'.
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["week-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["revenue"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-entries"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-detailed"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-all"] });
      toast.success("Estado actualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleStatusChange = (newStatus: AppointmentStatus) => {
    if (newStatus === "no_show") {
      setNoShowDialog(true);
    } else {
      updateStatus.mutate(newStatus);
    }
  };

  const handleNoShowResponse = (cancelledWithNotice: boolean) => {
    setNoShowDialog(false);
    if (cancelledWithNotice) {
      updateStatus.mutate("no_show");
    } else {
      updateStatus.mutate("done");
      toast.info("La sesión cuenta como realizada (sin aviso previo de 24h)");
    }
  };

  if (!appointment) return null;

  const typeConfig = SESSION_TYPE_COLORS[appointment.type];
  const statusActions: { status: AppointmentStatus; label: string; variant: "default" | "outline" | "secondary" | "destructive" }[] = [
    { status: "confirmed", label: "Confirmar", variant: "default" },
    { status: "done", label: "Marcar realizada", variant: "secondary" },
    { status: "cancelled", label: "Cancelar", variant: "destructive" },
    { status: "no_show", label: "No-show", variant: "outline" },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalle de cita</SheetTitle>
            <SheetDescription>Información y acciones de la cita</SheetDescription>
          </SheetHeader>

          <div className="space-y-5 mt-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</p>
              <p className="text-lg font-semibold">{(appointment.clients as any)?.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Profesional</p>
              <p className="font-medium">{(appointment.professionals as any)?.name || "Sin asignar"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Tipo de sesión</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${typeConfig.bg}`} />
                <span className="font-medium">{typeConfig.label}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Horario</p>
              <p className="font-medium">
                {format(new Date(appointment.start_time), "EEEE d MMM, HH:mm", { locale: es })} -{" "}
                {format(new Date(appointment.end_time), "HH:mm")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Estado actual</p>
              <span className={`inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[appointment.status]}`}>
                {STATUS_LABELS[appointment.status]}
              </span>
            </div>
            {appointment.notes && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Notas</p>
                <p className="text-sm mt-1">{appointment.notes}</p>
              </div>
            )}
            {appointment.status !== "done" && appointment.status !== "cancelled" && (
              <div className="space-y-2 pt-4 border-t">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Cambiar estado</p>
                <div className="grid grid-cols-2 gap-2">
                  {statusActions
                    .filter((a) => a.status !== appointment.status)
                    .map((action) => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        size="sm"
                        onClick={() => handleStatusChange(action.status)}
                        disabled={updateStatus.isPending}
                      >
                        {action.label}
                      </Button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={noShowDialog} onOpenChange={setNoShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar No-show</DialogTitle>
            <DialogDescription>
              ¿El cliente canceló con más de 24 horas de anticipación?
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Si el cliente <strong>no avisó</strong> con al menos 24 horas de anticipación, la sesión se marcará como <strong>realizada</strong> (cuenta como sesión usada).
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleNoShowResponse(true)}>
              Sí, avisó a tiempo
            </Button>
            <Button variant="destructive" onClick={() => handleNoShowResponse(false)}>
              No avisó a tiempo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
