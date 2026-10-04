import type { Product, ProductSale } from "@/types";

const monthOf = (value: string | Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(value));

/** Vendas pagas dentro de um intervalo [from, to). */
export function paidSales(sales: ProductSale[], from?: Date, to?: Date) {
  return sales.filter(
    (sale) =>
      sale.status === "paid" &&
      (!from || new Date(sale.createdAt) >= from) &&
      (!to || new Date(sale.createdAt) < to),
  );
}
export const salesTotal = (sales: ProductSale[]) =>
  Math.round(sales.reduce((sum, sale) => sum + sale.total * 100, 0)) / 100;

/** Resumo do mês corrente (São Paulo); margem só quando todo item vendido tem custo. */
export function monthSales(sales: ProductSale[], now: Date, products: Product[] = []) {
  const month = monthOf(now);
  const list = sales.filter((sale) => sale.status === "paid" && monthOf(sale.createdAt) === month);
  const items = list.flatMap((sale) => sale.items);
  const costs = new Map(products.map((product) => [product.id, product.cost]));
  const known = items.every((item) => typeof costs.get(item.productId) === "number");
  const margin =
    items.length && known
      ? Math.round(
          items.reduce(
            (sum, item) =>
              sum + (item.price - (costs.get(item.productId) as number)) * 100 * item.quantity,
            0,
          ),
        ) / 100
      : null;
  return {
    total: salesTotal(list),
    count: list.length,
    items: items.reduce((sum, item) => sum + item.quantity, 0),
    margin,
  };
}
export function lowStock(products: Product[]) {
  return products
    .filter((product) => product.active && product.stock <= product.minStock)
    .sort((a, b) => a.stock - b.stock);
}
