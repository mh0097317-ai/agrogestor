import { Scissors } from "@phosphor-icons/react/dist/ssr";

/**
 * O nome da casa com uma tesoura passando por cima: as letras acendem por
 * onde ela corta e fica um risco dourado embaixo. Toca ao entrar na etapa e
 * continua cortando enquanto os horários carregam. Nunca segura a tela.
 */
export function ScissorSign({ name, loading }: { name: string; loading?: boolean }) {
  return (
    <div className={`bk-sign ${loading ? "is-loading" : ""}`} aria-hidden="true">
      <span className="bk-sign-blade">
        <Scissors size={18} weight="fill" />
      </span>
      <span className="bk-sign-name">{name}</span>
      <span className="bk-sign-line" />
    </div>
  );
}
