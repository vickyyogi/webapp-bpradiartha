import { Home, ListTree, Calculator, Send, Info } from "lucide-react";

export default function FloatingMenu() {
  return (
    <nav
      aria-label="Navigasi cepat"
      className="fixed left-6 top-1/2 z-20 hidden -translate-y-1/2 xl:flex flex-col gap-2 rounded-full border border-lp-border bg-lp-card/80 p-2.5 shadow-xl backdrop-blur-md"
    >
      <a href="#beranda" aria-label="Beranda" className="lp-circle lp-circle-dark h-10 w-10">
        <Home className="h-4 w-4" />
      </a>
      <a href="#produk" aria-label="Produk" className="lp-circle lp-circle-light h-10 w-10">
        <ListTree className="h-4 w-4" />
      </a>
      <a href="#simulasi-kredit" aria-label="Simulasi kredit" className="lp-circle lp-circle-light h-10 w-10">
        <Calculator className="h-4 w-4" />
      </a>
      <a href="#form-pengajuan" aria-label="Formulir pengajuan" className="lp-circle lp-circle-light h-10 w-10">
        <Send className="h-4 w-4" />
      </a>
      <a href="#faq" aria-label="Tanya jawab" className="lp-circle lp-circle-light h-10 w-10">
        <Info className="h-4 w-4" />
      </a>
    </nav>
  );
}
