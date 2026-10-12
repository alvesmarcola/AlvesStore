import { notFound } from "next/navigation";

const pages: Record<string, { title: string; paragraphs: string[] }> = {
  "quem-somos": { title: "Quem somos", paragraphs: ["A Alves Store nasceu para quem carrega a paixão pelo futebol para além dos 90 minutos.", "Somos uma loja demonstrativa dedicada a reunir camisas e estilos para diferentes torcidas. Queremos que cada pessoa encontre um jeito próprio de vestir sua paixão.", "Nosso compromisso é oferecer uma experiência simples, transparente e feita para torcer junto."] },
  privacidade: { title: "Privacidade", paragraphs: ["Levamos sua privacidade a sério. Os dados informados nesta demonstração não são enviados nem armazenados em um servidor.", "Em uma loja em produção, coletaremos somente os dados necessários para processar pedidos, prestar atendimento e cumprir obrigações legais. Não comercializamos dados pessoais.", "Você poderá solicitar acesso, correção ou exclusão das informações pelos canais de atendimento."] },
  "envios-e-prazos": { title: "Envios e prazos", paragraphs: ["O frete é calculado pela quantidade total de camisas no pedido, independentemente dos clubes ou modelos: 1 camisa custa R$ 20,00; 2 camisas custam R$ 30,00; a partir de 3 camisas, o frete é grátis (R$ 0,00).", "O prazo começa a contar após a confirmação do pagamento e pode variar de acordo com a região."] },
  "compra-segura": { title: "Compra segura", paragraphs: ["Sua tranquilidade vem primeiro. Em uma loja real, o checkout usa conexão segura e provedores de pagamento certificados.", "Esta experiência é demonstrativa: nenhum pagamento é processado, e os formulários não enviam suas informações.", "Você tem até 7 dias corridos após o recebimento para solicitar uma devolução, conforme as regras aplicáveis ao consumidor."] },
  "como-comprar": { title: "Como comprar", paragraphs: ["Escolha uma categoria, liga ou clube e encontre a camisa que combina com a sua torcida.", "Selecione o tamanho, personalize se desejar e adicione o produto à sacola. O frete é de R$ 20,00 para 1 camisa, R$ 30,00 para 2 e grátis (R$ 0,00) a partir de 3 camisas no pedido.", "No checkout, preencha os dados e conclua o pagamento no ambiente seguro do Mercado Pago."] },
  contato: { title: "Fale com a gente", paragraphs: ["Nossa equipe está pronta para ajudar com dúvidas sobre produtos, tamanhos e pedidos.", "WhatsApp: atendimento todos os dias. E-mail: atendimento@alvesstore.com.br. Atendimento para todo o Brasil.", "Esta loja é uma demonstração de interface; os canais de atendimento serão conectados ao negócio na implantação."] },
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
