export default function Loading() {
  return <main className="mx-auto max-w-7xl px-4 py-10 lg:px-8" aria-label="Carregando conteúdo">
    <div className="h-8 w-56 animate-pulse rounded bg-paper" />
    <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-paper" />
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => <div key={index}><div className="aspect-[.79] animate-pulse rounded-lg bg-paper" /><div className="mt-3 h-4 animate-pulse rounded bg-paper" /><div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-paper" /></div>)}
    </div>
  </main>;
}
