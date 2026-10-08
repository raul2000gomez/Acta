"use client";

import { CalendarPlus, Copy, Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MeetingBundle } from "@/lib/meetings/queries";
import { meetingToText } from "@/lib/export/text";
import { meetingToICS } from "@/lib/export/ics";
import { tasksToCSV } from "@/lib/export/csv";
import { copyText, downloadFile, slugify } from "@/lib/export/download";
import { PRODUCT_NAME } from "@/lib/config";

/** Un solo botón de exportar (regla 4): PDF, texto, calendario, CSV. */
export function ExportMenu({ bundle }: { bundle: MeetingBundle }) {
  const base = slugify(bundle.meeting.title ?? "reunion") || "reunion";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => window.open(`/app/r/${bundle.meeting.id}/imprimir`, "_blank")}>
          <Printer /> PDF de una página
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            const ok = await copyText(meetingToText(bundle));
            if (ok) toast.success("Copiado como texto");
            else toast.error("No se pudo copiar");
          }}
        >
          <Copy /> Copiar como texto
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadFile(`${base}.ics`, meetingToICS(bundle, PRODUCT_NAME), "text/calendar;charset=utf-8")}>
          <CalendarPlus /> Fechas al calendario (.ics)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadFile(`${base}-tareas.csv`, tasksToCSV(bundle), "text/csv;charset=utf-8")}>
          <FileText /> Tareas en CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
