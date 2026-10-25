import { useEffect, useState } from 'react';
import { getMyCompany, GetMyCompanyOutputType } from 'zitejs/api';
import { loadCatalog } from './lib/catalogCache';
import CompanySetup from './components/CompanySetup';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useAuth, loginWithRedirect, logout } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import { Button } from '@project/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';
import Catalog from './pages/Catalog';
import QuickOrder from './pages/QuickOrder';
import MyOrders from './pages/MyOrders';
import { useCart } from './lib/cart';
import ThemeToggle from './components/ThemeToggle';
import LandingBackdrop from './components/LandingBackdrop';

export const LANDING_BG = 'https://files.zite.com/orgid-811092/base-e9ed7799171d5ba9/fieldid-fpTxbibVgbh/oarGTk6CaSUpqzkxCxxmdC/gshock-landing-bg.webp';

const LOGO = 'https://images.fillout.com/orgid-875710/flowpublicid-cruasebupv/widgetid-default/xf69MFSoK1nkWDgsfckrRV/G-Shock-Vapes-Logo.png';

function Brand() {
  return (
    <div className="flex items-center gap-3 font-semibold min-w-0">
      <span className="relative shrink-0">
        <span className="absolute -inset-1 rounded-xl bg-gradient-to-br from-primary/60 to-secondary/60 blur-md opacity-70" />
        <img src={LOGO} alt="G-Shock Vapes" className="relative h-9 w-9 rounded-xl object-cover ring-1 ring-white/20" />
      </span>
      <span className="hidden sm:block leading-tight">
        <span className="block text-sm font-extrabold text-gradient">G-Shock Vapes</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Partner Portal</span>
      </span>
    </div>
  );
}

function Nav() {
  const { cart } = useCart();
  const count = Object.keys(cart).length;
  const link = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'is-active' : ''}`;
  return (
    <header className="sticky top-0 z-20 px-3 sm:px-6 pt-3">
      <div className="glass top-nav max-w-7xl mx-auto h-14 px-3 sm:px-4 rounded-2xl border border-border/60 flex items-center justify-between gap-3 shadow-[0_18px_44px_-28px_hsl(var(--primary)/0.7)]">
        <Brand />
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={link} data-tone="pink">Catalog</NavLink>
          <NavLink to="/quick-order" className={link} data-tone="blue">
            Quick Order{count > 0 && <span className="rounded-full bg-secondary text-secondary-foreground px-1.5 min-w-[1.25rem] text-center text-[10px] font-bold leading-5 shadow-[0_0_12px_hsl(var(--secondary)/0.7)]">{count}</span>}
          </NavLink>
          <NavLink to="/orders" className={link} data-tone="gold">My Orders</NavLink>
        </nav>
        <div className="flex items-center gap-1"><ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut /><span className="hidden sm:inline">Sign out</span>
          </Button></div>
      </div>
    </header>
  );
}

function Pages() {
  const location = useLocation();
  const landing = location.pathname === '/';
  return (
    <>
    <LandingBackdrop src={LANDING_BG} position="18% center" opacity={0.1} />
    <main key={location.pathname} className={`animate-rise max-w-7xl mx-auto px-4 sm:px-8 py-8 ${landing ? 'landing' : ''}`}>
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/quick-order" element={<QuickOrder />} />
        <Route path="/orders" element={<MyOrders />} />
      </Routes>
    </main>
    </>
  );
}

export default function App() {
  const { user, isLoading } = useAuth();
  const [company, setCompany] = useState<GetMyCompanyOutputType['company'] | undefined>(undefined);
  const loadCompany = () => getMyCompany({}).then((r) => setCompany(r.company)).catch(() => setCompany(null));
  useEffect(() => {
    if (!isLoading && !user) loginWithRedirect();
    if (user) { loadCompany(); loadCatalog().catch(() => {}); }
  }, [isLoading, user]);

  if (isLoading || !user || company === undefined)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <LandingBackdrop src={LANDING_BG} position="18% center" />
        <Brand />
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (!company)
    return (
      <div className="landing min-h-screen px-4 py-10">
        <LandingBackdrop src={LANDING_BG} position="18% center" />
        <div className="mb-6 flex justify-center"><Brand /></div>
        <CompanySetup email={user.email} onDone={loadCompany} />
        <Toaster />
      </div>
    );

  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Nav />
        <Pages />
      </div>
      <Toaster />
    </BrowserRouter>
  );
}
