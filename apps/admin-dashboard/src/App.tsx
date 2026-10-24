import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { Avatar, AvatarFallback } from '@project/components/ui/avatar';
import { cn } from '@project/components/lib/utils';
import { LayoutDashboard, KanbanSquare, Package, Users, Wallet, MapPin, Loader2, Receipt, Route as RouteIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import Pipeline from './pages/Pipeline';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Payments from './pages/Payments';
import CustomerMap from './pages/CustomerMap';
import Expenses from './pages/Expenses';
import RoutePlan from './pages/RoutePlan';
import ThemeToggle from './components/ThemeToggle';
import ArchiveButton from './components/ArchiveButton';
import LandingBackdrop from './components/LandingBackdrop';

export const LOGO = 'https://images.fillout.com/orgid-875710/flowpublicid-cruasebupv/widgetid-default/xf69MFSoK1nkWDgsfckrRV/G-Shock-Vapes-Logo.png';
const BACKDROP = 'https://files.zite.com/orgid-811092/base-e9ed7799171d5ba9/fieldid-fpTxbibVgbh/oarGTk6CaSUpqzkxCxxmdC/gshock-landing-bg.webp';

const groups = [
  { title: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, tone: 'gold' },
    { to: '/orders', label: 'All Orders', icon: KanbanSquare, tone: 'pink' },
  ] },
  { title: 'Catalog & partners', items: [
    { to: '/products', label: 'Products', icon: Package, tone: 'blue' },
    { to: '/customers', label: 'Customers', icon: Users, tone: 'gold' },
  ] },
  { title: 'Delivery', items: [
    { to: '/map', label: 'Addresses', icon: MapPin, tone: 'green' },
    { to: '/routes', label: 'Route plan', icon: RouteIcon, tone: 'blue' },
  ] },
  { title: 'Money', items: [
    { to: '/payments', label: 'Payments', icon: Wallet, tone: 'green' },
    { to: '/expenses', label: 'Expenses', icon: Receipt, tone: 'pink' },
  ] },
];
const toneFor = (path: string) => groups.flatMap((g) => g.items).find((i) => i.to === '/' + (path.split('/')[1] || ''))?.tone ?? 'gold';

function Sidebar({ collapsed, onCollapse }: { collapsed: boolean; onCollapse: () => void }) {
  const { user } = useAuth();
  const initial = (user?.firstName?.[0] || user?.email?.[0] || 'G').toUpperCase();
  return (
    <aside className={cn(
      'glass z-40 border border-border/60 shadow-[0_20px_50px_-30px_hsl(var(--primary)/0.6)]',
      'sticky top-0 flex items-center gap-2 overflow-x-auto px-3 py-2 rounded-none border-x-0 border-t-0',
      'md:top-3 md:m-3 md:mr-0 md:h-[calc(100vh-1.5rem)] md:flex-col md:items-stretch md:overflow-visible md:rounded-2xl md:border md:p-0 md:transition-[width] md:duration-300',
      collapsed ? 'md:w-[4.25rem]' : 'md:w-64',
    )}>
      {/* Brand */}
      <div className={cn('flex items-center gap-3 shrink-0 md:p-4', collapsed && 'md:justify-center md:px-2')}>
        <span className="relative shrink-0">
          <span className="absolute -inset-1 rounded-xl bg-gradient-to-br from-primary/60 to-secondary/60 blur-md opacity-70" />
          <img src={LOGO} alt="G-Shock Vapes" className="relative h-9 w-9 md:h-10 md:w-10 rounded-xl object-cover ring-1 ring-white/20" />
        </span>
        {!collapsed && (
          <span className="hidden md:block min-w-0 leading-tight">
            <span className="block text-sm font-extrabold text-gradient truncate">G-Shock Vapes</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Admin</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex md:flex-col gap-1 md:gap-4 md:flex-1 md:overflow-y-auto md:px-3 md:pb-3">
        {groups.map((g) => (
          <div key={g.title} className="flex md:flex-col gap-1">
            {!collapsed
              ? <p className="hidden md:block px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">{g.title}</p>
              : <div className="hidden md:block mx-auto h-px w-6 bg-border" />}
            {g.items.map(({ to, label, icon: Icon, tone }) => (
              <NavLink key={to} to={to} end data-tone={tone} title={collapsed ? label : undefined}
                className={({ isActive }) => cn('nav-item whitespace-nowrap', isActive && 'is-active', collapsed && 'md:justify-center md:px-0')}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={cn(collapsed && 'md:hidden')}>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Archive + profile + controls */}
      <div className="ml-auto md:ml-0 shrink-0 flex md:block items-center gap-2">
        <div className="md:px-3 md:pb-2"><ArchiveButton collapsed={collapsed} /></div>
        <div className={cn('md:m-3 md:mt-1 md:rounded-xl md:border md:border-border/60 md:bg-background/40 md:p-2 flex gap-1 items-center', collapsed && 'md:flex-col')}>
          <div className={cn('hidden md:flex items-center gap-2 min-w-0 p-1', !collapsed && 'flex-1')}>
            <Avatar className="w-8 h-8 ring-2 ring-primary/30">
              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground text-xs font-bold">{initial}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block text-xs font-semibold truncate">{user?.firstName || user?.email}</span>
                <span className="block text-[10px] text-primary truncate">Team</span>
              </span>
            )}
          </div>
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="hidden md:inline-flex h-8 w-8 shrink-0" onClick={onCollapse} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        </div>
      </div>
    </aside>
  );
}

function Shell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  const toggle = () => setCollapsed((c) => { localStorage.setItem('sidebar-collapsed', c ? '0' : '1'); return !c; });
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <LandingBackdrop src={BACKDROP} position="18% center" opacity={0.1} />
      <Sidebar collapsed={collapsed} onCollapse={toggle} />
      <main data-tone={toneFor(location.pathname)} className="flex-1 p-4 md:p-8 min-w-0">
        <div key={location.pathname} className="animate-rise">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Pipeline />} />
            <Route path="/routes" element={<RoutePlan />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/products" element={<Products />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/map" element={<CustomerMap />} />
            <Route path="/payments" element={<Payments />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  if (isLoading || !user)
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  return (
    <BrowserRouter>
      <Shell />
      <Toaster />
    </BrowserRouter>
  );
}
