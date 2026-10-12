import { notFound } from "next/navigation";
import { formatCurrency } from "@/lib/catalog";
import { storeConfig } from "@/config";

const pages: Record<string, { title: string; paragraphs: string[] }> = {
  "quem-somos": { title: "Quem somos", paragraphs: ["A Alves Store nasceu para quem carrega a paixão pelo futebol para além dos 90 minutos.", "Somos uma loja demonstrativa dedicada a reunir camisas e estilos para diferentes torcidas. Queremos que cada pessoa encontre um jeito próprio de vestir sua paixão.", "Nosso compromisso é oferecer uma experiência simples, transparente e feita para torcer junto."] },
  privacidade: { title: "Privacidade", paragraphs: ["Levamos sua privacidade a sério. Os dados informados nesta demonstração não são enviados nem armazenados em um servidor.", "Em uma loja em produção, coletaremos somente os dados necessários para processar pedidos, prestar atendimento e cumprir obrigações legais. Não comercializamos dados pessoais.", "Você poderá solicitar acesso, correção ou exclusão das informações pelos canais de atendimento."] },
  "envios-e-prazos": { title: "Envios e prazos", paragraphs: ["Para pedidos de 1 ou 2 camisas, o frete precisa ser calculado e confirmado conforme o CEP.", `Na compra de 3 camisas, o pacote de ${formatCurrency(storeConfig.threeShirtPrice)} inclui frete grátis.`, "Esta versão demonstrativa não apresenta cotação ou prazo real de entrega."] },
  "compra-segura": { title: "Compra segura", paragraphs: ["Sua tranquilidade vem primeiro. Em uma loja real, o checkout usa conexão segura e provedores de pagamento certificados.", "Esta experiência é demonstrativa: nenhum pagamento é processado, e os formulários não enviam suas informações.", "Você tem até 7 dias corridos após o recebimento para solicitar uma devolução, conforme as regras aplicáveis ao consumidor."] },
  "como-comprar": { title: "Como comprar", paragraphs: ["Escolha uma categoria, liga ou clube e encontre a camisa que combina com a sua torcida.", `Selecione um tamanho listado, personalize se desejar por ${formatCurrency(storeConfig.customizationPrice)} adicionais por camisa e adicione o produto à sacola. Duas camisas custam ${formatCurrency(storeConfig.twoShirtPrice)} + frete; três custam ${formatCurrency(storeConfig.threeShirtPrice)} com frete incluído.`, "No checkout demonstrativo, preencha os dados e selecione uma forma de pagamento. Nenhuma cobrança será realizada nesta etapa. O frete de pedidos com uma ou duas camisas precisa ser confirmado."] },
  contato: { title: "Fale com a gente", paragraphs: ["Para dúvidas sobre os produtos ou pedidos, consulte o e-mail informado no rodapé.", "Esta loja é uma demonstração de interface; os canais de atendimento e o processamento de pedidos precisam ser confirmados antes da operação comercial."] },
};

export function generateStaticParams() {
  return Object.keys(pages).map((pagina) => ({ pagina }));
}

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }) {
  const { pagina } = await params;
  return { title: pages[pagina]?.title ?? "Página" };
}

export default async function InstitutionalPage({ params }: { params: Promise<{ pagina: string }> }) {
  const { pagina } = await params;
  const page = pages[pagina];
  if (!page) notFound();
  return <main className="mx-auto max-w-3xl px-5 py-12"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">ALVES STORE</p><h1 className="mt-2 text-3xl font-black">{page.title}</h1><div className="mt-7 space-y-5 text-sm leading-7 text-muted">{page.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></main>;
}
