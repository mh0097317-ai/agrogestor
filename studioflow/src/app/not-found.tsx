import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-page">
      <h1>Essa página não está por aqui.</h1>
      <p>Confira o endereço ou volte para sua agenda.</p>
      <Link href="/dashboard" className="btn btn-primary">
        Voltar ao início
      </Link>
    </div>
  );
}
