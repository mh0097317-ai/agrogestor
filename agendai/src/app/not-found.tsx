import Link from "next/link";
import { classesBotao, Logo } from "@/components/ui";

export default function NaoEncontrado() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Logo />
        <p className="mt-10 font-display text-7xl font-extrabold text-marca-500">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold text-ink">Essa página não existe</h1>
        <p className="mt-1 text-suave">Confira o link que você recebeu.</p>
        <Link href="/" className={classesBotao("escuro", "md", "mt-6")}>
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
