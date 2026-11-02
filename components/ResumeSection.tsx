'use client';

import { FileText, Download } from 'lucide-react';

interface ResumeSectionProps {
  pdfUrl?: string;
  pdfFileName?: string;
  className?: string;
}

export function ResumeSection({
  pdfUrl = '/curriculo-marco-alves.pdf',
  pdfFileName = 'Curriculo-Marco-Antonio-Alves.pdf',
  className = '',
}: ResumeSectionProps) {
  return (
    <section
      id="curriculo"
      className={`relative w-full py-28 sm:py-36 px-6 lg:px-12 bg-zinc-950 text-zinc-100 overflow-hidden flex flex-col items-center justify-center ${className}`}
    >
      {/* Luz ambiente sutil de fundo */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[320px] bg-indigo-500/10 blur-[130px] rounded-full"
        aria-hidden="true"
      />

      <div className="relative max-w-3xl w-full mx-auto flex flex-col items-center text-center">
        {/* 1. Cabeçalho Simples e Elegante */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
          Currículo <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-sky-300 bg-clip-text text-transparent">Profissional</span>
        </h2>
        
        <p className="max-w-xl text-sm sm:text-base text-zinc-400 leading-relaxed font-normal mb-12 sm:mb-16">
          Desenvolvedor Full-Stack &amp; Gestor de E-commerce, unindo tecnologia moderna, visão de negócios estratégica e disciplina analítica da Educação Física.
        </p>

        {/* 2. Card Centralizado Único (Minimalista & Sem Poluição) */}
        <div className="relative w-full max-w-xl p-8 sm:p-12 rounded-3xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md shadow-2xl flex flex-col items-center text-center group hover:border-zinc-700/80 transition-all duration-300">
          
          {/* Ícone Profissional */}
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 shadow-inner transition-transform duration-300 group-hover:scale-105">
            <FileText className="w-6 h-6" />
          </div>

          {/* Resumo de 2 linhas sobre versatilidade */}
          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-md mb-8">
            Do código à estratégia comercial: construo produtos web escaláveis com Next.js e Supabase, potencializados por vivência prática em vendas e rigor analítico.
          </p>

          {/* 3. Botão de Destaque Principal (CTA) */}
          <a
            href={pdfUrl}
            download={pdfFileName}
            target="_blank"
            rel="noopener noreferrer"
            className="group/btn inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 text-sm sm:text-base w-full sm:w-auto cursor-pointer"
          >
            <span>Baixar Currículo Completo (PDF)</span>
            <Download className="w-4 h-4 text-indigo-200 transition-transform duration-300 group-hover/btn:translate-y-0.5" />
          </a>

          {/* Micro-informação ATS */}
          <span className="mt-5 text-[11px] font-mono text-zinc-400 tracking-wider uppercase">
            Formato PDF • Padrão ATS • Pronto para Leitura
          </span>
        </div>
      </div>
    </section>
  );
}

export default ResumeSection;
