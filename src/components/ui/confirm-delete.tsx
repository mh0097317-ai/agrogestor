"use client";

import { Trash2 } from "lucide-react";
import { Button } from "./button";

export function ConfirmDeleteButton({
  action,
  label = "Excluir",
  message = "Tem certeza que deseja excluir? Esta ação pode ser desfeita apenas por um administrador.",
}: {
  action: () => Promise<void>;
  label?: string;
  message?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="ghost" size="sm" className="text-danger hover:bg-danger-bg">
        <Trash2 size={16} /> {label}
      </Button>
    </form>
  );
}
