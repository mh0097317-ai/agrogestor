import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/availability";
import { createSupabaseAdmin, requireMembership } from "@/lib/supabase/server";
import type { Product, ProductSale, Store } from "@/types";
import { isDemo, mutateDemo } from "./server-demo";
import { demoWorkspaceSlug } from "./server-store";
import { imageField } from "./server-validation";

const id = z.string().uuid();
const money = z.number().min(0).max(100000);

export const productSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "Dê um nome ao produto.").max(80),
  description: z.string().trim().max(300).default(""),
  price: money,
  cost: money.nullable().default(null),
  stock: z.number().int().min(0, "O estoque não pode ser negativo.").max(100000),
  minStock: z.number().int().min(0).max(100000).default(0),
  image: imageField.default(""),
  showPublic: z.boolean().default(true),
});
export const productActiveSchema = z.object({ id, active: z.boolean() });
export const saleSchema = z
  .object({
    items: z
      .array(z.object({ productId: id, quantity: z.number().int().min(1).max(999) }))
      .min(1, "Escolha pelo menos um produto.")
      .max(30),
    method: z.enum(["pix", "cash", "credit", "debit", "other"]),
    appointmentId: id.optional(),
    customerId: id.optional(),
    customerName: z.string().trim().max(100).default(""),
  })
  .refine(
    (sale) => new Set(sale.items.map((item) => item.productId)).size === sale.items.length,
    "Cada produto aparece uma vez na venda.",
  );
export const cancelSaleSchema = z.object({ id });

const editors = ["owner", "admin", "manager"];
async function requireRole(roles: string[], message: string) {
  const membership = await requireMembership();
  if (!roles.includes(membership.role)) throw new DomainError(message, 403);
  return membership;
}
const sellers = ["owner", "admin", "manager", "receptionist"];

/** Projeção pública: o que a casa vende, sem custo nem estoque. */
export function publicProducts(store: Store) {
  return (store.products || [])
    .filter((product) => product.active && product.showPublic && product.stock > 0)
    .map(({ id, name, description, price, image }) => ({ id, name, description, price, image }));
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** Same rules as sell_products in the migration, on the demo file. */
export function sellInStore(
  store: Store,
  input: z.infer<typeof saleSchema>,
  now = new Date(),
): ProductSale {
  store.products ??= [];
  let customerId: string | null = null,
    customerName = input.customerName;
  if (input.appointmentId) {
    const appointment = store.appointments.find((item) => item.id === input.appointmentId);
    if (!appointment) throw new DomainError("Atendimento não encontrado.", 404);
    customerId = appointment.customerId;
    customerName = appointment.customerName;
  } else if (input.customerId) {
    const customer = store.customers.find((item) => item.id === input.customerId);
    if (!customer) throw new DomainError("Cliente não encontrado.", 404);
    customerId = customer.id;
    customerName = customer.name;
  }
  const lines = input.items.map((item) => {
    const product = store.products!.find(
      (candidate) => candidate.id === item.productId && candidate.active,
    );
    if (!product) throw new DomainError("Produto não encontrado.", 404);
    if (product.stock < item.quantity)
      throw new DomainError(`Estoque insuficiente de ${product.name}.`, 409);
    return { product, quantity: item.quantity };
  });
  for (const line of lines) line.product.stock -= line.quantity;
  const sale: ProductSale = {
    id: randomUUID(),
    businessId: store.business.id,
    appointmentId: input.appointmentId || null,
    customerId,
    customerName,
    items: lines.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      quantity,
      price: product.price,
    })),
    total:
      Math.round(lines.reduce((sum, line) => sum + line.product.price * 100 * line.quantity, 0)) /
      100,
    method: input.method,
    status: "paid",
    createdAt: now.toISOString(),
  };
  (store.productSales ??= []).push(sale);
  return sale;
}
export function cancelInStore(store: Store, saleId: string) {
  const sale = store.productSales?.find((item) => item.id === saleId);
  if (!sale) throw new DomainError("Venda não encontrada.", 404);
  if (sale.status === "cancelled") return sale;
  for (const item of sale.items) {
    const product = store.products?.find((candidate) => candidate.id === item.productId);
    if (product) product.stock += item.quantity;
  }
  sale.status = "cancelled";
  return sale;
}

/* ------------------------------------------------------------------ */
/* Workspace actions                                                   */
/* ------------------------------------------------------------------ */

export async function saveProduct(input: z.infer<typeof productSchema>) {
  if (isDemo())
    return mutateDemo((store) => {
      store.products ??= [];
      const existing = input.id
        ? store.products.find((product) => product.id === input.id)
        : undefined;
      if (input.id && !existing) throw new DomainError("Produto não encontrado.", 404);
      if (existing) Object.assign(existing, input);
      else
        store.products.push({
          ...input,
          id: randomUUID(),
          businessId: store.business.id,
          active: true,
          createdAt: new Date().toISOString(),
        } as Product);
      return { ok: true };
    }, await demoWorkspaceSlug());
  const { businessId } = await requireRole(
    editors,
    "Só o dono ou a gerência podem alterar os produtos.",
  );
  const admin = createSupabaseAdmin();
  const row = {
    name: input.name,
    description: input.description,
    price: input.price,
    cost: input.cost,
    stock: input.stock,
    min_stock: input.minStock,
    image: input.image,
    show_public: input.showPublic,
  };
  if (input.id) {
    const { data, error } = await admin
      .from("products")
      .update(row)
      .eq("business_id", businessId)
      .eq("id", input.id)
      .select("id");
    if (error) throw new DomainError("Não foi possível salvar o produto.", 503);
    if (!data?.length) throw new DomainError("Produto não encontrado.", 404);
  } else {
    const { data: business } = await admin
      .from("businesses")
      .select("tenant_id")
      .eq("id", businessId)
      .single();
    const { error } = await admin
      .from("products")
      .insert({ ...row, tenant_id: business!.tenant_id, business_id: businessId });
    if (error) throw new DomainError("Não foi possível criar o produto.", 503);
  }
  return { ok: true };
}

export async function setProductActive(input: z.infer<typeof productActiveSchema>) {
  if (isDemo())
    return mutateDemo((store) => {
      const product = store.products?.find((item) => item.id === input.id);
      if (!product) throw new DomainError("Produto não encontrado.", 404);
      product.active = input.active;
      return { ok: true };
    }, await demoWorkspaceSlug());
  const { businessId } = await requireRole(
    editors,
    "Só o dono ou a gerência podem alterar os produtos.",
  );
  const { data, error } = await createSupabaseAdmin()
    .from("products")
    .update({ active: input.active })
    .eq("business_id", businessId)
    .eq("id", input.id)
    .select("id");
  if (error) throw new DomainError("Não foi possível salvar o produto.", 503);
  if (!data?.length) throw new DomainError("Produto não encontrado.", 404);
  return { ok: true };
}

const saleErrors: [RegExp, string, number][] = [
  [/insufficient stock: (.+)/, "Estoque insuficiente de $1.", 409],
  [/product not found/, "Produto não encontrado ou arquivado.", 404],
  [/appointment not found/, "Atendimento não encontrado.", 404],
  [/customer not found/, "Cliente não encontrado.", 404],
  [/sale not found/, "Venda não encontrada.", 404],
  [/forbidden/, "Você não possui permissão para esta venda.", 403],
];
function saleError(message: string) {
  for (const [pattern, text, status] of saleErrors) {
    const match = message.match(pattern);
    if (match) return new DomainError(text.replace("$1", match[1] || ""), status);
  }
  return new DomainError("Não foi possível registrar a venda.", 409);
}

export async function sellProducts(input: z.infer<typeof saleSchema>) {
  if (isDemo())
    return mutateDemo((store) => sellInStore(store, input), await demoWorkspaceSlug());
  const { businessId, user } = await requireRole(
    sellers,
    "Você não possui permissão para registrar vendas.",
  );
  const { data, error } = await createSupabaseAdmin().rpc("sell_products", {
    p_business_id: businessId,
    p_user_id: user.id,
    p_input: input,
  });
  if (error) throw saleError(error.message);
  return data;
}

export async function cancelSale(input: z.infer<typeof cancelSaleSchema>) {
  if (isDemo())
    return mutateDemo((store) => cancelInStore(store, input.id), await demoWorkspaceSlug());
  const { businessId, user } = await requireRole(
    editors,
    "Só o dono ou a gerência podem cancelar uma venda.",
  );
  const { data, error } = await createSupabaseAdmin().rpc("cancel_product_sale", {
    p_business_id: businessId,
    p_user_id: user.id,
    p_sale_id: input.id,
  });
  if (error) throw saleError(error.message);
  return data;
}
