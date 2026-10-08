"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onSave: (value: string) => Promise<{ ok: boolean; error?: string }>;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  as?: "span" | "p" | "h1" | "h2";
  disabled?: boolean;
};

/**
 * Texto que se edita en el sitio (regla 5): clic y se cambia, se guarda al
 * salir o con Enter, Escape cancela. Sin modales ni botón de guardar.
 */
export function EditableText({ value, onSave, multiline, placeholder, className, inputClassName, as = "span", disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Estado derivado: si el valor cambia desde fuera (otra edición, revalidación), se refleja.
  if (value !== lastValue) {
    setLastValue(value);
    if (!editing) setDraft(value);
  }

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [editing]);

  async function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next === value.trim()) return;
    if (!next) {
      setDraft(value);
      return;
    }
    const r = await onSave(next);
    if (r.ok) {
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 1500);
    } else {
      setError(r.error ?? "No se pudo guardar");
      setDraft(value);
    }
  }

  const Tag = as;

  if (editing) {
    const shared = {
      ref,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void commit();
        }
      },
      placeholder,
      className: cn(
        "w-full rounded-md border border-ring bg-background px-2 py-1 outline-none ring-[3px] ring-ring/30",
        inputClassName,
        className,
      ),
    };
    return multiline ? <textarea {...shared} rows={Math.min(12, Math.max(2, draft.split("\n").length))} /> : <input {...shared} />;
  }

  return (
    <Tag
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? undefined : 0}
      title={disabled ? undefined : "Clic para editar"}
      onClick={() => !disabled && setEditing(true)}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        "relative -mx-1 rounded-md px-1 py-0.5 text-left",
        !disabled && "cursor-text transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
        multiline && "whitespace-pre-wrap",
        !value && "text-muted-foreground italic",
        className,
      )}
    >
      {value || placeholder}
      {saved && (
        <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle text-xs font-normal text-success">
          <Check className="size-3" /> Guardado
        </span>
      )}
      {error && <span className="ml-1.5 text-xs text-destructive">{error}</span>}
    </Tag>
  );
}
