const adultRows = [["P", "88–96", "72–80", "88–96"], ["M", "96–104", "80–88", "96–104"], ["G", "104–112", "88–96", "104–112"], ["GG", "112–120", "96–104", "112–120"], ["2GG", "120–128", "104–112", "120–128"], ["3GG", "128–136", "112–120", "128–136"]];
const femaleRows = [["PP", "78–84", "60–66", "84–90"], ["P", "84–90", "66–72", "90–96"], ["M", "90–96", "72–78", "96–102"], ["G", "96–104", "78–86", "102–110"], ["GG", "104–112", "86–94", "110–118"]];
const childRows = [["4 anos", "56–60", "54–58", "60–64"], ["6 anos", "60–64", "58–62", "64–68"], ["8 anos", "64–68", "60–64", "68–72"], ["10 anos", "68–72", "62–66", "72–76"], ["12 anos", "72–78", "64–68", "76–82"]];

function Measurements({ title, rows }: { title: string; rows: string[][] }) {
  return <section className="mt-8 overflow-hidden rounded-xl border"><h2 className="bg-pitch px-5 py-4 text-sm font-black text-white">{title}</h2><div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead className="bg-paper"><tr>{["Tamanho", "Peito (cm)", "Cintura (cm)", "Quadril (cm)"].map((item) => <th key={item} className="px-4 py-3 font-bold">{item}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-t">{row.map((value) => <td key={value} className="px-4 py-3">{value}</td>)}</tr>)}</tbody></table></div></section>;
}

export const metadata = { title: "Guia de medidas", description: "Consulte as medidas e encontre o tamanho ideal para sua camisa." };

export default function SizeGuidePage() {
  return <main className="mx-auto max-w-4xl px-5 py-10"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Vista com confiança</p><h1 className="mt-2 text-3xl font-black">Guia de medidas</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">As medidas são aproximadas, em centímetros. Compare com uma peça que você já usa e prefira medir sobre uma superfície plana.</p><Measurements title="Adulto — modelagem unissex" rows={adultRows} /><Measurements title="Feminino — modelagem acinturada" rows={femaleRows} /><Measurements title="Infantil — por idade" rows={childRows} /><div className="mt-6 rounded-lg bg-lime/25 p-4 text-sm"><strong>Como medir:</strong> peito na parte mais larga, cintura na altura do umbigo e quadril na região mais larga. Em caso de dúvida entre dois tamanhos, escolha o maior para um caimento mais confortável.</div></main>;
}
