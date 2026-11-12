import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-page">
      <h1>Essa página não está por aqui.</h1>
      <p>
        Confira o endereço. Se você recebeu o link de uma barbearia, peça para
        ela enviar de novo.
      </p>
      <Link href="/" className="btn btn-primary">
        Ir para o início
      </Link>
    </div>
  );
}
