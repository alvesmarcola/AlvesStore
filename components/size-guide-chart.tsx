import Image from "next/image";

export type SizeMeasurement = {
  label: string;
  values: string[];
};

type SizeGuideChartProps = {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  sizes: string[];
  measurements: SizeMeasurement[];
  imageHeight: number;
};

export function SizeGuideChart({
  id,
  title,
  description,
  image,
  imageAlt,
  sizes,
  measurements,
  imageHeight,
}: SizeGuideChartProps) {
  return <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-700">Tabela de medidas</p>
        <h2 id={`${id}-title`} className="mt-1 text-xl font-black sm:text-2xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
    </div>

    <figure className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
      <div className="relative w-full bg-white" style={{ aspectRatio: `810 / ${imageHeight}` }}>
        <Image src={image} alt={imageAlt} fill sizes="(max-width: 810px) 100vw, 810px" className="object-contain" />
      </div>
      <figcaption className="border-t border-border px-3 py-2 text-center text-xs text-muted">Imagem oficial da tabela de referência</figcaption>
    </figure>

    <div className="mt-5 hidden overflow-x-auto rounded-xl border border-border sm:block">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <caption className="sr-only">{title} por tamanho</caption>
        <thead className="bg-ink text-white">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">Medida</th>
            {sizes.map((size) => <th scope="col" key={size} className="px-4 py-3 text-center font-bold">{size}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {measurements.map((measurement) => <tr key={measurement.label} className="odd:bg-paper/70">
            <th scope="row" className="whitespace-nowrap px-4 py-3 font-semibold">{measurement.label}</th>
            {measurement.values.map((value, index) => <td key={`${measurement.label}-${sizes[index]}`} className="whitespace-nowrap px-4 py-3 text-center tabular-nums">{value}</td>)}
          </tr>)}
        </tbody>
      </table>
    </div>

    <div className="mt-5 grid gap-3 sm:hidden">
      {sizes.map((size, sizeIndex) => <article key={size} className="rounded-xl border border-border bg-paper/60 p-4">
        <h3 className="text-sm font-black">Tamanho {size}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          {measurements.map((measurement) => <div key={measurement.label}>
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{measurement.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">{measurement.values[sizeIndex]}</dd>
          </div>)}
        </dl>
      </article>)}
    </div>
  </section>;
}
