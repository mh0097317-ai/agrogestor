"use client";

import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  Archive,
  ArrowCounterClockwise,
  Eye,
  EyeSlash,
  Package,
  PencilSimple,
  Plus,
  ShoppingBagOpen,
  Warning,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { ImageUpload } from "@/components/image-upload";
import { Button, Card, EmptyState, MetricStrip, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { money } from "@/lib/utils";
import type { Product, ProductSale, Store } from "@/types";
import { FormError, FormField, ManagementBoundary } from "./shared";
import { SaleSheet } from "./sale-sheet";
import { monthSales, lowStock } from "./product-metrics";
import "./products.css";
import { ModuleGate } from "@/features/dashboard/module-lock";

export default function ProductsPage() {
  const { data } = useWorkspace();
  return (
    <ManagementBoundary>
      <ModuleGate module="produtos">{data && <ProductsContent store={data} />}</ModuleGate>
    </ManagementBoundary>
  );
}

const methodLabel: Record<ProductSale["method"], string> = {
  pix: "Pix",
  cash: "Dinheiro",
  credit: "Crédito",
  debit: "Débito",
  other: "Outro",
};

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível.");
  return data;
}

function ProductsContent({ store }: { store: Store }) {
  const { refresh } = useWorkspace();
  const { canManage, canMutate } = usePermissions();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [selling, setSelling] = useState(false);
  const [cancelling, setCancelling] = useState<ProductSale | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [now] = useState(() => new Date());
  const products = store.products || [];
  const sales = store.productSales || [];
  const active = products.filter((product) => product.active);
  const archived = products.filter((product) => !product.active);
  const month = monthSales(sales, now, products);
  const low = lowStock(active);
  const canSell = canMutate("appointments");

  async function act(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await task();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="shop-page">
      <PageHeader
        title="Produtos"
        description="Pomadas, óleos e o que mais a casa vende. Registre a venda no balcão ou no atendimento e o estoque baixa sozinho."
        actions={
          <>
            {canManage && (
              <Button variant="secondary" onClick={() => setEditing("new")}>
                <Plus size={16} /> Novo produto
              </Button>
            )}
            {canSell && (
              <Button onClick={() => setSelling(true)} disabled={!active.length}>
                <ShoppingBagOpen size={16} /> Nova venda
              </Button>
            )}
          </>
        }
      />
      <MetricStrip
        className="shop-metrics"
        items={[
          { label: "Vendido no mês", value: money(month.total), detail: `${month.count} vendas` },
          { label: "Itens vendidos", value: month.items, detail: "no mês" },
          {
            label: "Lucro estimado",
            value: month.margin === null ? "—" : money(month.margin),
            detail: month.margin === null ? "Informe o custo dos produtos" : "Preço menos custo",
          },
          {
            label: "Estoque baixo",
            value: low.length,
            detail: low.length ? low.slice(0, 2).map((item) => item.name).join(", ") : "Tudo em dia",
          },
        ]}
      />
      <FormError error={error} />
      {active.length === 0 ? (
        <Card className="shop-empty">
          <EmptyState
            title="Nenhum produto ainda"
            description="Ex.: Pomada modeladora R$ 45,00, 12 em estoque. Com a foto, ele também aparece na sua página."
            action={
              canManage ? (
                <Button onClick={() => setEditing("new")}>
                  <Plus size={16} /> Cadastrar o primeiro
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="shop-grid">
          {active.map((product, index) => {
            const isLow = product.stock <= product.minStock;
            return (
              <Card
                key={product.id}
                className={`shop-card ${product.stock === 0 ? "is-out" : isLow ? "is-low" : ""}`}
                style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
              >
                <div className="shop-photo">
                  {product.image ? <img src={product.image} alt="" /> : <Package size={30} weight="duotone" />}
                  <span className="shop-stock">
                    {product.stock === 0
                      ? "Sem estoque"
                      : `${product.stock} em estoque`}
                  </span>
                </div>
                <div className="shop-info">
                  <h3>{product.name}</h3>
                  <p className="shop-price">{money(product.price)}</p>
                  {isLow && product.stock > 0 && (
                    <p className="shop-alert">
                      <Warning size={13} /> Repor: mínimo {product.minStock}
                    </p>
                  )}
                  <p className="shop-public">
                    {product.showPublic ? <Eye size={13} /> : <EyeSlash size={13} />}
                    {product.showPublic ? "Na sua página" : "Só no balcão"}
                  </p>
                </div>
                {canManage && (
                  <div className="shop-actions">
                    <Button variant="secondary" onClick={() => setEditing(product)} disabled={!!busy}>
                      <PencilSimple size={15} /> Editar
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      aria-label={`Arquivar ${product.name}`}
                      onClick={() =>
                        void act(`archive-${product.id}`, async () => {
                          await send("/api/workspace/products", "PATCH", { id: product.id, active: false });
                          toast("Produto arquivado.");
                        })
                      }
                    >
                      <Archive size={15} />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {archived.length > 0 && (
        <div className="shop-archived">
          <button type="button" className="shop-link" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Esconder" : "Ver"} arquivados ({archived.length})
          </button>
          {showArchived && (
            <ul>
              {archived.map((product) => (
                <li key={product.id}>
                  <span>{product.name}</span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() =>
                        void act(`open-${product.id}`, async () => {
                          await send("/api/workspace/products", "PATCH", { id: product.id, active: true });
                          toast("Produto reativado.");
                        })
                      }
                    >
                      <ArrowCounterClockwise size={15} /> Reativar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <section className="shop-sales">
        <h2>Últimas vendas</h2>
        {sales.length === 0 ? (
          <p className="shop-muted">As vendas registradas aparecem aqui e entram no Financeiro.</p>
        ) : (
          <Card className="shop-sale-list">
            {sales.slice(0, 30).map((sale) => (
              <div key={sale.id} className={`shop-sale ${sale.status === "cancelled" ? "is-cancelled" : ""}`}>
                <div className="shop-sale-main">
                  <strong>
                    {sale.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}
                  </strong>
                  <span>
                    {format(new Date(sale.createdAt), "dd/MM HH:mm")}
                    {sale.customerName ? ` · ${sale.customerName}` : ""}
                    {sale.appointmentId ? " · no atendimento" : ""} · {methodLabel[sale.method]}
                  </span>
                </div>
                <b>{sale.status === "cancelled" ? "Cancelada" : money(sale.total)}</b>
                {canManage && sale.status === "paid" && (
                  <button
                    type="button"
                    className="shop-cancel"
                    aria-label="Cancelar venda"
                    title="Cancelar venda e devolver ao estoque"
                    onClick={() => setCancelling(sale)}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>
      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            toast(editing === "new" ? "Produto cadastrado." : "Produto atualizado.");
            setEditing(null);
          }}
        />
      )}
      <SaleSheet store={store} open={selling} onClose={() => setSelling(false)} />
      <Modal
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancelar esta venda?"
        description="Os itens voltam para o estoque e o valor sai do caixa."
      >
        <div className="management-form-actions">
          <Button variant="secondary" onClick={() => setCancelling(null)}>
            Manter
          </Button>
          <Button
            disabled={!!busy}
            onClick={() =>
              cancelling &&
              void act("cancel", async () => {
                await send("/api/workspace/products/sales", "PATCH", { id: cancelling.id });
                setCancelling(null);
                toast("Venda cancelada. Estoque devolvido.");
              })
            }
          >
            {busy === "cancel" ? "Cancelando…" : "Cancelar venda"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [image, setImage] = useState(product?.image || "");
  const [showPublic, setShowPublic] = useState(product?.showPublic ?? true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const number = (value: FormDataEntryValue | null) =>
    Number(String(value || "0").replace(",", "."));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const cost = String(form.get("cost") || "").trim();
    setBusy(true);
    setError("");
    try {
      await send("/api/workspace/products", "POST", {
        ...(product ? { id: product.id } : {}),
        name: form.get("name"),
        description: form.get("description") || "",
        price: number(form.get("price")),
        cost: cost ? number(cost) : null,
        stock: Math.round(number(form.get("stock"))),
        minStock: Math.round(number(form.get("minStock"))),
        image,
        showPublic,
      });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={product ? "Editar produto" : "Novo produto"}>
      <form className="management-form" onSubmit={submit}>
        <ImageUpload
          label="Foto"
          preset="service"
          shape="card"
          value={image}
          onChange={setImage}
          onBusy={setUploading}
          emptyTitle="Foto do produto"
        />
        <FormField label="Nome">
          <input name="name" required minLength={2} maxLength={80} defaultValue={product?.name} placeholder="Pomada modeladora matte" />
        </FormField>
        <FormField label="Descrição (opcional)">
          <input name="description" maxLength={300} defaultValue={product?.description} placeholder="Fixação média, efeito seco. 120 g." />
        </FormField>
        <div className="management-form-grid">
          <FormField label="Preço de venda (R$)">
            <input name="price" required inputMode="decimal" defaultValue={product?.price ?? ""} placeholder="45,00" />
          </FormField>
          <FormField label="Custo (R$, opcional)" hint="Para calcular o lucro.">
            <input name="cost" inputMode="decimal" defaultValue={product?.cost ?? ""} placeholder="22,00" />
          </FormField>
          <FormField label="Em estoque">
            <input name="stock" required type="number" min={0} max={100000} defaultValue={product?.stock ?? 0} />
          </FormField>
          <FormField label="Avisar quando chegar a" hint="Alerta de estoque baixo.">
            <input name="minStock" type="number" min={0} max={100000} defaultValue={product?.minStock ?? 2} />
          </FormField>
        </div>
        <label className="shop-toggle">
          <input type="checkbox" checked={showPublic} onChange={(event) => setShowPublic(event.target.checked)} />
          <span>
            <strong>Mostrar na minha página</strong>
            <small>Aparece em “Na casa você encontra”, com foto e preço.</small>
          </span>
        </label>
        <FormError error={error} />
        <div className="management-form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || uploading}>
            {busy ? "Salvando…" : "Salvar produto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
