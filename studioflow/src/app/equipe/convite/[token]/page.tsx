import Link from "next/link";
import { notFound } from "next/navigation";
import {
  professionalInviteView,
  inviteTokenSchema,
} from "@/services/professional-access";
import { AcceptInvite } from "./accept-invite";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!inviteTokenSchema.safeParse(token).success) notFound();
  const invitation = await professionalInviteView(token);
  return (
    <main
      className="management-page"
      style={{ maxWidth: 560, margin: "60px auto", padding: 24 }}
    >
      <Link href="/">StudioFlow</Link>
      <h1>
        {invitation
          ? `Seu acesso à ${invitation.businessName}`
          : "Convite indisponível"}
      </h1>
      {invitation ? (
        <>
          <p>
            {invitation.professionalName}, entre com sua conta individual para
            acessar sua agenda, seus contatos e conectar seu WhatsApp. Use o
            e-mail indicado ao responsável pela barbearia.
          </p>
          <AcceptInvite token={token} />
        </>
      ) : (
        <p>
          Este convite expirou, já foi utilizado ou o profissional não está
          ativo. Peça um novo ao responsável.
        </p>
      )}
    </main>
  );
}
