import Link from "next/link";

export const metadata = {
  title: "Dúvidas frequentes | Alves Store",
  description: "Entenda o envio internacional, o prazo do código de rastreio e como acompanhar seu pedido.",
  alternates: { canonical: "/duvidas" },
};

const questions = [
  {
    question: "De onde meu pedido será enviado?",
    answer: "Os pedidos são despachados diretamente dos centros de distribuição internacionais dos nossos parceiros para o endereço informado na compra.",
  },
  {
    question: "Quando recebo o código de rastreio?",
    answer: "Após a confirmação do pagamento, o código de rastreio oficial é gerado e enviado para o e-mail cadastrado em até 3 a 4 dias úteis. Esse período é necessário para a liberação e a postagem logística do pedido.",
  },
  {
    question: "Posso receber o rastreio pelo WhatsApp?",
    answer: "Sim. No checkout, marque a opção de receber atualizações transacionais pelo WhatsApp. O e-mail continua sendo o canal usado para as comunicações do pedido.",
  },
  {
    question: "Como acompanho a rota da encomenda?",
    answer: "Use a página de rastreio da Alves Store com o código do pedido e o e-mail ou CPF cadastrado na compra. Quando o código oficial estiver disponível, ele será exibido junto ao status.",
  },
];

export default function QuestionsPage() {
  return <main className="mx-auto max-w-3xl px-5 py-12">
    <p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">ALVES STORE · ATENDIMENTO</p>
    <h1 className="mt-2 text-3xl font-black">Dúvidas frequentes</h1>
    <p className="mt-3 text-sm leading-6 text-muted">Informações sobre envio, liberação logística e acompanhamento do seu pedido.</p>
    <div className="mt-8 space-y-4">
      {questions.map(({ question, answer }) => <details key={question} className="group rounded-xl border border-border p-5 open:bg-paper">
        <summary className="cursor-pointer list-none font-bold marker:hidden">{question}<span className="float-right text-blue-700 transition-transform group-open:rotate-45" aria-hidden="true">＋</span></summary>
        <p className="mt-4 text-sm leading-6 text-muted">{answer}</p>
      </details>)}
    </div>
    <Link href="/rastreio" className="primary-button mt-7 inline-flex px-6 py-3 text-xs font-black uppercase">Acompanhar meu pedido</Link>
  </main>;
}
