import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { storeConfig } from "@/config";
import { ContactForm } from "./contact-form";

type InstitutionalPage = {
  title: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
  references?: { label: string; href: string }[];
};

const pages: Record<string, InstitutionalPage> = {
  "quem-somos": {
    title: "Quem somos",
    intro: "A Alvis Store é para quem leva a paixão pelo esporte para além do jogo.",
    sections: [
      { heading: "Futebol e automobilismo", paragraphs: [
        "Somos especializados em camisas de futebol importadas — versões torcedor e jogador, modelos retrô e kits infantis — e em artigos de Fórmula 1.",
        "Selecionamos produtos com atenção à qualidade, variedade e clareza das informações. Cada página de produto apresenta os detalhes disponíveis e o Guia de Medidas ajuda você a escolher o tamanho com mais segurança.",
      ] },
      { heading: "Atendimento em todo o Brasil", paragraphs: [
        "Os pedidos são encaminhados aos centros de distribuição internacionais dos nossos parceiros e enviados ao endereço informado na compra. Acompanhamos o pedido e disponibilizamos o rastreio assim que o código oficial estiver disponível.",
        "Atendemos e enviamos para todo o Brasil. Nosso compromisso é oferecer uma experiência de compra transparente, com pagamento processado pelo Mercado Pago e canais de atendimento por e-mail e WhatsApp.",
      ] },
    ],
  },
  privacidade: {
    title: "Política de privacidade",
    intro: "Esta política explica como as informações são usadas quando você navega, entra em contato ou faz um pedido na Alvis Store.",
    sections: [
      { heading: "Dados que recebemos", paragraphs: [
        "Para processar um pedido, podemos tratar nome, CPF, e-mail, telefone, endereço de entrega, itens comprados e informações sobre o pagamento. Se você falar com o atendimento, também usamos os dados que enviar na mensagem.",
        "O site guarda no navegador a opção escolhida no aviso de cookies.",
      ] },
      { heading: "Como usamos os dados", paragraphs: [
        "Usamos os dados para confirmar e processar pedidos, receber pagamentos, encaminhar a entrega, prestar suporte, informar o rastreio e cumprir obrigações legais. O pagamento é processado pelo Mercado Pago; a Alvis Store não recebe os dados completos do cartão.",
        "Para concluir a entrega, os dados necessários do pedido são compartilhados com os parceiros responsáveis pelo envio. As informações do pedido ficam armazenadas no sistema operacional da loja. Quando os serviços correspondentes estão configurados, dados mínimos também podem ser enviados aos provedores de e-mail e de notificações transacionais por WhatsApp.",
      ] },
      { heading: "Acesso, segurança e direitos", paragraphs: [
        "Mantemos os dados pelo tempo necessário para atender às finalidades do pedido e às obrigações legais aplicáveis. Adotamos controles de acesso e segurança compatíveis com a operação e limitamos o uso às finalidades informadas.",
        "Você pode solicitar confirmação de tratamento, acesso, correção ou outras providências previstas na LGPD pelo e-mail atendimento@alvesstore.com.br. Para proteger sua conta e seus dados, poderemos confirmar sua identidade antes de atender à solicitação.",
      ] },
      { heading: "Responsável pelo atendimento de privacidade", paragraphs: [
        "A Alvis Store recebe solicitações de privacidade pelo e-mail atendimento@alvesstore.com.br. Para proteger os dados, o atendimento pode confirmar a identidade de quem faz a solicitação.",
      ] },
    ],
    references: [{ label: "Lei Geral de Proteção de Dados (LGPD)", href: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" }],
  },
  "envios-e-prazos": {
    title: "Envios e prazos",
    intro: "Veja como funciona o envio internacional, o frete e o acompanhamento do seu pedido.",
    sections: [
      { heading: "Preparação e postagem", paragraphs: [
        "Após a confirmação do pagamento, o pedido é encaminhado ao centro de distribuição internacional do parceiro responsável. O despacho segue para o endereço informado no checkout.",
        "O código de rastreio oficial é gerado e enviado ao e-mail cadastrado em até 3 a 4 dias úteis após a confirmação do pagamento. Se você autorizou notificações pelo WhatsApp no checkout, também poderá receber a atualização por esse canal. Esse período é usado para liberação e postagem logística; não representa o prazo total de entrega.",
      ] },
      { heading: "Frete", paragraphs: [
        "O valor do frete é o mesmo para qualquer produto: R$ 20,00 para 1 item, R$ 30,00 para 2 itens e grátis a partir de 3 itens no pedido. O total do frete aparece antes da confirmação do pagamento.",
      ] },
      { heading: "Acompanhe a entrega", paragraphs: [
        "Quando receber o código, acesse a página de Rastreio da loja e informe o código do pedido e o e-mail ou CPF usados na compra. O rastreio oficial será exibido assim que estiver disponível.",
        "O prazo total de transporte pode variar conforme a operação logística e o destino. Consulte as informações apresentadas no checkout e as atualizações do rastreio; não prometemos um prazo de entrega que não esteja confirmado para o seu pedido.",
      ] },
    ],
  },
  "politica-de-troca": {
    title: "Trocas e devoluções",
    intro: "Compras online e produtos importados continuam protegidos pelos direitos previstos na legislação brasileira.",
    sections: [
      { heading: "Arrependimento da compra", paragraphs: [
        "Você pode exercer o direito de arrependimento no prazo legal de 7 dias contado do recebimento do produto, conforme o artigo 49 do Código de Defesa do Consumidor. Para iniciar a solicitação, escreva para atendimento@alvesstore.com.br ou fale com a loja pelo WhatsApp, informando o código do pedido.",
        "A equipe confirma o recebimento da solicitação e orienta os próximos passos para a devolução. Aguarde as instruções antes de enviar qualquer produto.",
      ] },
      { heading: "Tamanho, defeito ou divergência", paragraphs: [
        "Antes da compra, consulte o Guia de Medidas. As medidas são feitas manualmente e uma diferença de 1 a 3 cm pode ocorrer; o guia é uma referência para ajudar na escolha, não uma renúncia aos direitos do consumidor.",
        "Se o produto apresentar defeito ou não corresponder ao pedido, entre em contato com a loja e descreva o ocorrido. Envie fotos quando isso ajudar a identificar o problema. A solicitação será tratada conforme os direitos e prazos previstos em lei.",
      ] },
      { heading: "Como falar com a loja", paragraphs: [
        "Use o e-mail atendimento@alvesstore.com.br ou o WhatsApp informado na página de Contato. Inclua o código do pedido para que possamos localizar a compra e orientar o atendimento.",
      ] },
    ],
    references: [{ label: "Código de Defesa do Consumidor, artigo 49", href: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" }],
  },
  "termos-de-uso": {
    title: "Termos de uso e compra",
    intro: "Ao navegar ou comprar na Alvis Store, use o site de forma lícita e confira as informações do pedido antes de pagar.",
    sections: [
      { heading: "Produtos e disponibilidade", paragraphs: [
        "As páginas apresentam as descrições, imagens, tamanhos disponíveis e valores cadastrados para cada produto. A disponibilidade pode mudar até a confirmação do pedido; a loja informa qualquer impedimento identificado no processamento.",
        "Os produtos importados são enviados pelos centros de distribuição internacionais dos parceiros. Consulte o Guia de Medidas e as informações específicas do produto antes de concluir a compra.",
      ] },
      { heading: "Preço, pagamento e frete", paragraphs: [
        "O preço e o frete aplicáveis são apresentados no carrinho e no checkout antes da confirmação. O pagamento é processado pelo Mercado Pago. O pedido segue para preparação depois da confirmação do pagamento.",
      ] },
      { heading: "Entrega, atendimento e direitos", paragraphs: [
        "O código oficial de rastreio é informado em até 3 a 4 dias úteis após a confirmação do pagamento; se você autorizou notificações no checkout, a atualização também pode chegar pelo WhatsApp. O prazo de transporte pode variar. Para dúvidas, cancelamento ou suporte, utilize os canais da página de Contato.",
        "Estes termos não limitam direitos garantidos pela legislação brasileira, incluindo os direitos de arrependimento, troca e privacidade descritos nas páginas correspondentes.",
      ] },
    ],
    references: [{ label: "Decreto nº 7.962/2013 — comércio eletrônico", href: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm" }],
  },
  "compra-segura": {
    title: "Compra segura",
    intro: "As etapas da compra são apresentadas antes da confirmação do pedido.",
    sections: [{ heading: "Pagamento e pedido", paragraphs: [
      "O pagamento é processado pelo Mercado Pago. Confira os produtos, tamanhos, endereço e valores no checkout antes de concluir. Após a aprovação, o pedido é encaminhado ao parceiro responsável pela preparação e envio.",
      "Para dúvidas sobre uma compra, fale com atendimento@alvesstore.com.br ou use o WhatsApp da página de Contato.",
    ] }],
  },
  "como-comprar": {
    title: "Como comprar",
    intro: "Escolha seus produtos, confira os tamanhos e conclua o pagamento com os dados de entrega corretos.",
    sections: [{ heading: "Passo a passo", paragraphs: [
      "1. Navegue pelas categorias, ligas ou clubes e abra o produto desejado.\n2. Confira as informações e selecione o tamanho disponível; consulte o Guia de Medidas se precisar.\n3. Adicione os itens ao carrinho, confira o frete e informe seus dados de contato e entrega.\n4. Revise o total e finalize o pagamento pelo Mercado Pago.",
      "Depois da confirmação do pagamento, o pedido segue para preparação internacional. O código oficial de rastreio é enviado em até 3 a 4 dias úteis e poderá ser consultado na página Rastreio.",
    ] }],
  },
  "politica-de-personalizacao": {
    title: "Política de personalização",
    intro: "Confira os dados de personalização com atenção antes de concluir o pedido.",
    sections: [{ heading: "Nome e número", paragraphs: [
      `A personalização de nome e número custa ${formatCurrency(storeConfig.customizationPrice)} por camisa, quando disponível no produto. Verifique a grafia e o número informado antes de pagar.`,
      "Se precisar corrigir um dado, entre em contato imediatamente pelo e-mail ou WhatsApp da loja. Direitos relativos a defeito, erro de produção, divergência do pedido ou arrependimento são tratados conforme a legislação aplicável.",
    ] }],
  },
  contato: {
    title: "Fale com a gente",
    intro: "Estamos disponíveis para ajudar com produtos, pedidos, pagamentos e rastreio.",
    sections: [{ heading: "Atendimento", paragraphs: [
      "Para agilizar o atendimento, informe o código do pedido e o e-mail usado na compra. Não envie dados completos de cartão por e-mail ou WhatsApp.",
    ] }],
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const whatsappUrl = "https://wa.me/5499968814?text=Ol%C3%A1%2C%20Alves%20Store!%20Preciso%20de%20ajuda.";

export function generateStaticParams() {
  return Object.keys(pages).map((pagina) => ({ pagina }));
}

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }): Promise<Metadata> {
  const { pagina } = await params;
  const page = pages[pagina];
  return { title: page?.title ?? "Página", ...(page ? { description: page.intro } : {}), alternates: { canonical: `/${pagina}` } };
}

export default async function InstitutionalPage({ params }: { params: Promise<{ pagina: string }> }) {
  const { pagina } = await params;
  const page = pages[pagina];
  if (!page) return notFound();

  return <main className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
    <header className="rounded-2xl bg-ink px-6 py-8 text-white sm:px-10 sm:py-10">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-action">Alvis Store · informações</p>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">{page.intro}</p>
    </header>

    {pagina === "contato" && <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Canais de contato">
      <a href={`mailto:${storeConfig.email}`} className="group flex min-h-28 items-center gap-4 rounded-xl border border-border bg-white p-5 transition hover:border-blue-300 hover:shadow-sm">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Mail size={20} /></span>
        <span className="min-w-0"><span className="block text-xs font-black uppercase">E-mail</span><span className="mt-1 block break-all text-sm text-muted">{storeConfig.email}</span></span><ArrowUpRight size={16} className="ml-auto shrink-0 text-muted transition group-hover:text-blue-700" />
      </a>
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="group flex min-h-28 items-center gap-4 rounded-xl border border-border bg-white p-5 transition hover:border-green-300 hover:shadow-sm">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-green-50 text-green-700"><MessageCircle size={20} /></span>
        <span><span className="block text-xs font-black uppercase">WhatsApp</span><span className="mt-1 block text-sm text-muted">+54 9996-8814 · atendimento rápido</span></span><ArrowUpRight size={16} className="ml-auto shrink-0 text-muted transition group-hover:text-green-700" />
      </a>
    </section>}

    <div className="mt-6 space-y-4">
      {page.sections.map((section) => <section key={section.heading} className="rounded-xl border border-border bg-white p-5 sm:p-7">
        <h2 className="text-lg font-black">{section.heading}</h2>
        <div className="mt-3 space-y-3 text-sm leading-7 text-muted">{section.paragraphs.map((paragraph) => <p key={paragraph} className="whitespace-pre-line">{paragraph}</p>)}</div>
      </section>)}
    </div>

    {pagina === "contato" && <ContactForm email={storeConfig.email} />}
    {pagina === "politica-de-troca" && <p className="mt-5 text-sm text-muted">Quer iniciar uma solicitação? <Link href="/contato" className="font-bold text-blue-700 underline underline-offset-2">Fale com a equipe de atendimento</Link>.</p>}
    {pagina === "envios-e-prazos" && <p className="mt-5 text-sm text-muted">Para acompanhar um pedido, acesse <Link href="/rastreio" className="font-bold text-blue-700 underline underline-offset-2">Rastrear pedido</Link>.</p>}
    {page.references && <nav aria-label="Legislação relacionada" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">{page.references.map((reference) => <a key={reference.href} href={reference.href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{reference.label}</a>)}</nav>}
  </main>;
}
