"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, PageHeader } from "@/components/ui";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { hasModule } from "@/lib/modules";
import { AssistantSettings } from "@/features/management/assistant-settings";
import { AssistantSimulator } from "@/features/management/assistant-simulator";
import { ManagementBoundary } from "@/features/management/shared";

export default function TrainingPage() {
  const router = useRouter();
  const { data, refresh } = useWorkspace();
  const { canManage } = usePermissions();
  return (
    <ManagementBoundary>
      <PageHeader
        title="Recepcionista IA"
        description="Seu jeito de conversar, em cada atendimento."
        actions={
          <Link className="management-link-button" href="/dashboard/conversas">
            Acompanhar conversas →
          </Link>
        }
      />
      {data &&
        (hasModule(data.access?.modules, "recepcionista") ? (
          canManage ? (
            <div className="training-layout">
              <div className="training-columns">
                <Card className="training-surface">
                  <AssistantSettings
                    store={data}
                    canManage={canManage}
                    onSaved={refresh}
                    onOpenWhatsApp={() =>
                      router.push("/dashboard/configuracoes?aba=whatsapp")
                    }
                  />
                </Card>
                <AssistantSimulator store={data} />
              </div>
            </div>
          ) : (
            <Card>
              O responsável pelo estabelecimento configura o treinamento. Você
              pode acompanhar seus atendimentos em “Acompanhar conversas”.
            </Card>
          )
        ) : (
          <Card>
            O treinamento está disponível no módulo de atendimento com IA.
          </Card>
        ))}
    </ManagementBoundary>
  );
}
