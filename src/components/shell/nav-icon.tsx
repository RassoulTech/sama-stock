import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Warehouse,
  Bike,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon } from "./nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  sales: ReceiptText,
  orders: Bike,
  products: Package,
  stock: Warehouse,
  customers: Users,
  suppliers: Truck,
  reports: BarChart3,
  team: UserCog,
  billing: CreditCard,
  settings: Settings,
  admin: ShieldCheck,
};

export function NavIconView({ icon, className }: { icon: NavIcon; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}
