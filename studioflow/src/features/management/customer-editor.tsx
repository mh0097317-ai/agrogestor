"use client";
import type { FormEvent } from "react";
import { Button, DetailPanel, FormSection } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import type { Customer } from "@/types";
import {
  FormField,
  FormError,
  SubmitButton,
  useFormAction,
  brazilianPhone,
} from "./shared";

export function CustomerEditor({
  customer,
  onClose,
}: {
  customer: Customer | null | undefined;
  onClose: () => void;
}) {
  const { data, mutate } = useWorkspace();
  const { canMutate } = usePermissions();
  const { toast } = useToast();
  const action = useFormAction();
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canMutate("customers") || action.busy) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (name.length < 3) {
      action.setError("Informe o nome completo do cliente.");
      return;
    }
    if (!brazilianPhone(phone)) {
      action.setError("Informe um WhatsApp brasileiro válido com DDD.");
      return;
    }
    void action.run(async () => {
      await mutate("customers", customer ? "update" : "create", {
        ...(customer ?? {
          id: crypto.randomUUID(),
          visits: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString(),
        }),
        businessId: data!.business.id,
        name,
        phone,
        email,
      });
      toast(customer ? "Cliente atualizado." : "Cliente cadastrado.");
      onClose();
    });
  }
  return (
    <DetailPanel
      open={customer !== undefined}
      onClose={() => {
        if (!action.busy) onClose();
      }}
      title={customer ? "Editar cliente" : "Novo cliente"}
      description="O primeiro passo para uma boa relação."
    >
      <form className="management-form" onSubmit={save} aria-busy={action.busy}>
        <FormSection
          title="Dados de contato"
          description="Use estes dados para reconhecer seu cliente e combinar o próximo horário."
        >
          <FormField label="Nome completo">
            <input
              name="name"
              defaultValue={customer?.name}
              required
              minLength={3}
              maxLength={100}
              autoComplete="name"
            />
          </FormField>
          <FormField
            label="WhatsApp"
            hint="Inclua o DDD. Exemplo: (11) 99999-9999."
          >
            <input
              name="phone"
              defaultValue={customer?.phone}
              type="tel"
              required
              autoComplete="tel"
            />
          </FormField>
          <FormField label="E-mail (opcional)">
            <input
              name="email"
              defaultValue={customer?.email}
              type="email"
              autoComplete="email"
            />
          </FormField>
        </FormSection>
        <FormError error={action.error} />
        <div className="management-form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <SubmitButton busy={action.busy}>Salvar cliente</SubmitButton>
        </div>
      </form>
    </DetailPanel>
  );
}
