import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { storeConfig } from "@/config";
import { formatCurrency } from "@/lib/catalog";

export function SiteFooter() {
  return <footer className="mt-20 bg-pitch text-white">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-4 lg:px-8">
      <div><Link href="/" className="text-2xl font-black uppercase tracking-tight">ALVES <span className="text-action">STORE</span></Link><p className="mt-3 max-w-xs text-sm leading-6 text-white/65">A camisa certa muda o jogo. Vista as cores do seu time.</p></div>
      <div><h2 className="mb-4 text-xs font-black uppercase tracking-widest text-action">Institucional</h2><div className="grid gap-2 text-sm text-white/70"><Link href="/quem-somos">Quem somos</Link><Link href="/privacidade">Privacidade</Link><Link href="/envios-e-prazos">Envios e prazos</Link><Link href="/compra-segura">Compra segura</Link><Link href="/como-comprar">Como comprar</Link><Link href="/contato">Contato</Link></div></div>
      <div><h2 className="mb-4 text-xs font-black uppercase tracking-widest text-action">Atendimento</h2><div className="grid gap-3 text-sm text-white/70"><span className="flex items-center gap-2"><Mail size={16} />{storeConfig.email}</span><Link href="/rastreio">Rastreio demonstrativo</Link><Link href="/guia-de-medidas">Guia de medidas</Link></div></div>
      <div><h2 className="mb-4 text-xs font-black uppercase tracking-widest text-action">Condições</h2><div className="grid gap-3 text-sm text-white/70"><span>3 camisas por {formatCurrency(storeConfig.threeShirtPrice)} com frete grátis</span><span>Personalização: +{formatCurrency(storeConfig.customizationPrice)} por camisa</span><span className="flex items-center gap-2"><Instagram size={17} />@alvesstore</span></div></div>
    </div>
    <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/45">© {new Date().getFullYear()} ALVES STORE. Todos os direitos reservados.</div>
  </footer>;
}
