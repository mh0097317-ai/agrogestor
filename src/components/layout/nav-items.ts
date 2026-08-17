import {
  LayoutDashboard,
  Warehouse,
  Grid2x2,
  Sprout,
  Wrench,
  Package,
  Tractor,
  Wheat,
  Landmark,
  ShoppingCart,
  FileBarChart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  fase?: number; // fases futuras aparecem como "em breve"
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/fazendas", label: "Fazendas", icon: Warehouse },
  { href: "/talhoes", label: "Talhões", icon: Grid2x2 },
  { href: "/safras", label: "Safras", icon: Sprout },
  { href: "/operacoes", label: "Operações", icon: Wrench, fase: 3 },
  { href: "/estoque", label: "Estoque", icon: Package, fase: 2 },
  { href: "/maquinas", label: "Máquinas", icon: Tractor, fase: 4 },
  { href: "/colheita", label: "Colheita", icon: Wheat, fase: 5 },
  { href: "/financeiro", label: "Financeiro", icon: Landmark, fase: 6 },
  { href: "/comercial", label: "Comercial", icon: ShoppingCart, fase: 7 },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart, fase: 8 },
  { href: "/assistente", label: "Assistente IA", icon: Sparkles, fase: 9 },
];
