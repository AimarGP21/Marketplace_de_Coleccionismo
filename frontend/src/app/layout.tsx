import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'RelicVault | Marketplace de Coleccionismo Exclusivo',
  description: 'Compra y venta de coleccionables auténticos protegidos por pagos seguros en Stripe.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
          <p>© 2026 RelicVault Marketplace. Integrado con FastAPI y Stripe Sandbox SDK.</p>
        </footer>
      </body>
    </html>
  );
}
