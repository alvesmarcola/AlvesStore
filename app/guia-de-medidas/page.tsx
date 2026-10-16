import { SizeGuideChart, type SizeMeasurement } from "@/components/size-guide-chart";

export const metadata = {
  title: "Guia de tamanhos | Alves Store",
  description: "Consulte as tabelas de medidas masculinas, femininas e infantis das camisas.",
  alternates: { canonical: "/guia-de-medidas" },
};

const charts: {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  imageHeight: number;
  sizes: string[];
  measurements: SizeMeasurement[];
}[] = [
  {
    id: "masculino",
    title: "Masculino / Torcedor",
    description: "Consulte comprimento, largura, altura e faixa de peso indicativa para cada tamanho.",
    image: "/guia-de-medidas/masculino.png",
    imageAlt: "Tabela oficial de medidas da camisa masculina versão torcedor",
    imageHeight: 321,
    sizes: ["S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"],
    measurements: [
      { label: "Comprimento da camisa (cm)", values: ["70", "72", "74", "76", "78", "80", "82"] },
      { label: "Largura da camisa (cm)", values: ["48", "50", "52", "54", "56", "58", "60"] },
      { label: "Altura indicada (cm)", values: ["162–170", "170–176", "176–182", "182–190", "190–195", "192–197", "197–200"] },
      { label: "Peso indicado (kg)", values: ["50–62", "62–78", "78–83", "83–90", "90–97", "97–104", "104–110"] },
    ],
  },
  {
    id: "feminino",
    title: "Feminino",
    description: "Medidas de referência da camisa feminina. A tabela original não indica tamanhos acima de XXL.",
    image: "/guia-de-medidas/feminino.png",
    imageAlt: "Tabela oficial de medidas da camisa feminina versão torcedora",
    imageHeight: 321,
    sizes: ["S", "M", "L", "XL", "XXL"],
    measurements: [
      { label: "Comprimento da camisa (cm)", values: ["65", "67", "69", "70", "71"] },
      { label: "Largura da camisa (cm)", values: ["44", "46", "48", "49,5", "51"] },
      { label: "Altura indicada (cm)", values: ["150–160", "160–165", "165–170", "170–175", "175–178"] },
      { label: "Peso indicado (kg)", values: ["45–55", "50–60", "60–70", "65–75", "75–85"] },
    ],
  },
  {
    id: "kids",
    title: "Infantil (Kids)",
    description: "Além da camisa, esta tabela apresenta a medida da calça e uma faixa de idade indicativa.",
    image: "/guia-de-medidas/kids.png",
    imageAlt: "Tabela oficial de medidas do conjunto infantil de camisa e calção",
    imageHeight: 361,
    sizes: ["16", "18", "20", "22", "24", "26", "28"],
    measurements: [
      { label: "Comprimento da camisa (cm)", values: ["43", "47", "50", "53", "56", "58", "61"] },
      { label: "Largura da camisa (cm)", values: ["32", "34", "36", "38", "40", "42", "44"] },
      { label: "Comprimento da calça (cm)", values: ["30", "32", "34", "36", "38", "40", "42"] },
      { label: "Altura indicada (cm)", values: ["95–105", "105–115", "115–125", "125–135", "135–145", "145–155", "155–165"] },
      { label: "Idade indicada", values: ["2–3", "3–4", "4–5", "6–7", "8–9", "10–11", "12–13"] },
    ],
  },
];

export default function SizeGuidePage() {
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
    <header className="mb-8 rounded-2xl bg-ink px-5 py-7 text-white sm:px-8 sm:py-9">
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-action">Alves Store · escolha seu tamanho</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">Guia de tamanhos</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Compare as medidas de referência das camisas masculinas, femininas e infantis antes de escolher.</p>
      <nav aria-label="Categorias de medidas" className="mt-5 flex flex-wrap gap-2">
        {charts.map((chart) => <a key={chart.id} href={`#${chart.id}`} className="rounded-full border border-white/25 px-4 py-2 text-xs font-bold transition-colors hover:bg-white/10">{chart.title}</a>)}
      </nav>
    </header>

    <div className="space-y-6">
      {charts.map((chart) => <SizeGuideChart key={chart.id} {...chart} />)}
    </div>

    <aside className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <p className="font-bold">Aviso sobre as medidas</p>
      <p className="mt-1">Os dados acima são de medição manual, e a diferença de 1 a 3 cm é normal. Os tamanhos são apenas para referência.</p>
    </aside>
  </main>;
}
