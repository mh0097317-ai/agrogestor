"use client";
import { Clock3, MessageCircle, Pencil } from "lucide-react";
import {
  Avatar,
  Button,
  DetailPanel,
  FormSection,
  MetricStrip,
  StatusBadge,
} from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { dateLabel, money } from "@/lib/utils";
import type { Customer } from "@/types";
import { WhatsAppLink } from "./shared";
import {
  customerDays,
  customerNeedsReturn,
  customerVisitLabel,
} from "@/lib/customer-metrics";

export function CustomerProfile({
  customer,
  onClose,
  onEdit,
}: {
  customer?: Customer;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
}) {
  const { data } = useWorkspace();
  const { canMutate } = usePermissions();
  const history = (data?.appointments ?? [])
    .filter((appointment) => appointment.customerId === customer?.id)
    .sort((a, b) => b.start.localeCompare(a.start));
  return (
    <DetailPanel
      open={!!customer}
      onClose={onClose}
      title="Perfil do cliente"
      description="Cada visita faz parte da história."
    >
      {customer && (
        <div className="crm-profile">
          <div className="crm-profile-identity">
            <Avatar name={customer.name} size={64} />
            <div>
              <h3>{customer.name}</h3>
              <p>{customer.phone}</p>
              {customer.email && <p>{customer.email}</p>}
            </div>
          </div>
          <MetricStrip
            className="crm-profile-metrics"
            items={[
              { label: "Atendimentos", value: customer.visits },
              { label: "Total recebido", value: money(customer.totalSpent) },
            ]}
          />
          <div className="crm-profile-last">
            <Clock3 size={16} />
            <span>
              Última visita:{" "}
              {customerVisitLabel(customer).toLocaleLowerCase("pt-BR")}
            </span>
          </div>
          {customerNeedsReturn(customer) && (
            <div className="crm-return-note">
              <Clock3 size={18} />
              <p>
                {customer.name.split(" ")[0]} costuma retornar a cada{" "}
                <strong>{customer.returnInterval} dias</strong> e está há{" "}
                <strong>{customerDays(customer.lastVisit)} dias</strong> sem
                visitar. Que tal um convite?
              </p>
            </div>
          )}
          <div className="crm-profile-actions">
            <WhatsAppLink
              phone={customer.phone}
              message={`Olá, ${customer.name.split(" ")[0]}! Aqui é da ${data?.business.name}. Vamos agendar seu próximo horário?`}
            >
              <MessageCircle size={16} />
              Chamar no WhatsApp
            </WhatsAppLink>
            {canMutate("customers") && (
              <Button variant="secondary" onClick={() => onEdit(customer)}>
                <Pencil size={16} />
                Editar cadastro
              </Button>
            )}
          </div>
          <FormSection
            title="Preferências"
            description="Identificadas a partir dos atendimentos concluídos."
          >
            <dl className="crm-preferences">
              <div>
                <dt>Serviço favorito</dt>
                <dd>
                  {customer.favoriteService || "Sem histórico suficiente"}
                </dd>
              </div>
              <div>
                <dt>Profissional mais visitado</dt>
                <dd>
                  {customer.favoriteProfessional || "Sem histórico suficiente"}
                </dd>
              </div>
            </dl>
          </FormSection>
          <FormSection
            title="Histórico de atendimentos"
            description={`${history.length} agendamentos registrados.`}
          >
            <ol className="crm-history">
              {history.map((appointment) => (
                <li key={appointment.id}>
                  <span
                    className={`crm-history-dot status-${appointment.status}`}
                  />
                  <time dateTime={appointment.start}>
                    {dateLabel(appointment.start, "dd MMM yyyy · HH:mm")}
                  </time>
                  <div className="crm-history-title">
                    <strong>
                      {appointment.serviceIds
                        .map(
                          (id) =>
                            data?.services.find((service) => service.id === id)
                              ?.name || "Serviço arquivado",
                        )
                        .join(" + ")}
                    </strong>
                    <b>{money(appointment.price)}</b>
                  </div>
                  <p>
                    {data?.professionals.find(
                      (person) => person.id === appointment.professionalId,
                    )?.name || "Profissional arquivado"}
                  </p>
                  <StatusBadge status={appointment.status} />
                </li>
              ))}
            </ol>
            {!history.length && (
              <p className="crm-profile-empty">
                Ainda não há agendamentos registrados para este cliente.
              </p>
            )}
          </FormSection>
        </div>
      )}
    </DetailPanel>
  );
}
