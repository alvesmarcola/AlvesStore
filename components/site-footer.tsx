import Link from "next/link";
import { Mail } from "lucide-react";
import { storeConfig } from "@/config";
import { formatCurrency } from "@/lib/catalog";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return <footer className="mt-20 bg-pitch text-white">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-4 lg:px-8">
      <div><Link href="/" className="text-2xl font-bold tracking-tight">{SITE_NAME}</Link><p className="mt-3 max-w-xs text-sm leading-6 text-white/65">A camisa certa muda o jogo. Vista a paixão pelo seu time com a {SITE_NAME}.</p></div>
      <div><h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-action">Institucional</h2><div className="grid gap-2 text-sm text-white/70"><Link href="/quem-somos">Quem somos</Link><Link href="/privacidade">Privacidade</Link><Link href="/politica-de-troca">Trocas e devoluções</Link><Link href="/politica-de-personalizacao">Personalização</Link><Link href="/termos-de-uso">Termos de uso</Link><Link href="/envios-e-prazos">Envios e prazos</Link><Link href="/contato">Contato</Link></div></div>
      <div><h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-action">Atendimento</h2><div className="grid gap-3 text-sm text-white/70"><span className="flex items-center gap-2"><Mail size={16} />{storeConfig.email}</span><Link href="/rastreio">Rastrear pedido</Link><Link href="/duvidas">Dúvidas frequentes</Link><Link href="/guia-de-medidas">Guia de medidas</Link></div></div>

      <div><h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-action">Condições</h2><div className="grid gap-2 text-sm leading-5 text-white/70"><span>Promoção por quantidade: 2 camisas por {formatCurrency(storeConfig.twoShirtPrice)} ou 3 por {formatCurrency(storeConfig.threeShirtPrice)}.</span><span>Frete: {formatCurrency(storeConfig.shippingPrice)} (1 ou 2 itens) · grátis a partir de {storeConfig.freeShippingQuantity} itens.</span><span>Personalização: +{formatCurrency(storeConfig.customizationPrice)} por camisa.</span></div></div>
    </div>
    <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/45">© {new Date().getFullYear()} {SITE_NAME}. Todos os direitos reservados.</div>
  </footer>;
}
