"use client";

import { useMemo, useState } from "react";
import { Minus, Package, Plus, ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import { Button, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { money } from "@/lib/utils";
import type { Appointment, PaymentMethod, Store } from "@/types";
import { FormError } from "./shared";

const methods: { id: PaymentMethod; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "cash", label: "Dinheiro" },
  { id: "credit", label: "Crédito" },
  { id: "debit", label: "Débito" },
  { id: "other", label: "Outro" },
];

/**
 * Nova venda: escolher produtos, quantidade e forma de pagamento. Aberta
 * no balcão (Produtos) ou dentro de um atendimento.
 */
export function SaleSheet({
  store,
  open,
  onClose,
  appointment,
}: {
  store: Store;
  open: boolean;
  onClose: () => void;
  appointment?: Appointment | null;
}) {
  const { refresh } = useWorkspace();
  const { toast } = useToast();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [customer, setCustomer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const products = useMemo(
    () => (store.products || []).filter((product) => product.active),
    [store.products],
  );
  const lines = products
    .filter((product) => cart[product.id])
    .map((product) => ({ product, quantity: cart[product.id] }));
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  function change(id: string, delta: number, stock: number) {
    setCart((current) => {
      const next = Math.max(0, Math.min(stock, (current[id] || 0) + delta));
      const copy = { ...current };
      if (next) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  }
  function close() {
    setCart({});
    setError("");
    setCustomer("");
    onClose();
  }
  async function submit() {
    // A name picked from the list links the sale to that customer.
    const known = store.customers.find(
      (person) => person.name.toLowerCase() === customer.trim().toLowerCase(),
    );
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace/products/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
          method,
          ...(appointment
            ? { appointmentId: appointment.id }
            : known
              ? { customerId: known.id }
              : { customerName: customer.trim() }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar.");
      await refresh();
      toast(`Venda de ${money(total)} registrada.`);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={appointment ? `Venda para ${appointment.customerName.split(" ")[0]}` : "Nova venda"}
      description={
        appointment
          ? "Entra no caixa junto com o atendimento."
          : "Venda no balcão. O estoque baixa na hora."
      }
    >
      <div className="sale-sheet">
        {products.length === 0 ? (
          <p className="sale-empty">
            <Package size={20} /> Cadastre produtos em Produtos para vender aqui.
          </p>
        ) : (
          <ul className="sale-products">
            {products.map((product) => {
              const quantity = cart[product.id] || 0;
              const out = product.stock === 0;
              return (
                <li key={product.id} className={`${quantity ? "is-on" : ""} ${out ? "is-out" : ""}`}>
                  <span className="sale-thumb">
                    {product.image ? <img src={product.image} alt="" /> : <Package size={18} />}
                  </span>
                  <span className="sale-name">
                    <strong>{product.name}</strong>
                    <small>
                      {money(product.price)} · {out ? "sem estoque" : `${product.stock} em estoque`}
                    </small>
                  </span>
                  <span className="sale-qty">
                    <button
                      type="button"
                      onClick={() => change(product.id, -1, product.stock)}
                      disabled={!quantity}
                      aria-label={`Tirar um ${product.name}`}
                    >
                      <Minus size={14} weight="bold" />
                    </button>
                    <b aria-live="polite">{quantity}</b>
                    <button
                      type="button"
                      onClick={() => change(product.id, 1, product.stock)}
                      disabled={quantity >= product.stock}
                      aria-label={`Adicionar um ${product.name}`}
                    >
                      <Plus size={14} weight="bold" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {!appointment && (
          <label className="management-field">
            <span>Cliente (opcional)</span>
            <input
              value={customer}
              maxLength={100}
              list="sale-customers"
              placeholder="Nome de quem está levando"
              onChange={(event) => setCustomer(event.target.value)}
            />
            <datalist id="sale-customers">
              {store.customers.slice(0, 300).map((person) => (
                <option key={person.id} value={person.name} />
              ))}
            </datalist>
          </label>
        )}
        <div className="sale-methods" role="radiogroup" aria-label="Forma de pagamento">
          {methods.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={method === item.id}
              className={method === item.id ? "is-on" : ""}
              onClick={() => setMethod(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <FormError error={error} />
        <div className="sale-total">
          <span>
            {count ? `${count} ${count === 1 ? "item" : "itens"}` : "Nenhum item"}
            <strong>{money(total)}</strong>
          </span>
          <Button type="button" disabled={!count || busy} onClick={() => void submit()}>
            <ShoppingBagOpen size={16} />
            {busy ? "Registrando…" : "Registrar venda"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
