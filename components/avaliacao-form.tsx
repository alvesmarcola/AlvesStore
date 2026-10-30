"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Star, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "alves_store_review_last_sent";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface AvaliacaoFormProps {
  onSuccess?: () => void;
  className?: string;
}

export function AvaliacaoForm({ onSuccess, className = "" }: AvaliacaoFormProps) {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [comentario, setComentario] = useState("");
  const [nota, setNota] = useState(5);
  const [hoverNota, setHoverNota] = useState(0);
  const [honeypot, setHoneypot] = useState("");

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Check localStorage for 1 submission per day per browser
  useEffect(() => {
    try {
      const lastSent = localStorage.getItem(STORAGE_KEY);
      if (lastSent) {
        const elapsed = Date.now() - parseInt(lastSent, 10);
        if (elapsed < ONE_DAY_MS) {
          setAlreadySubmitted(true);
        }
      }
    } catch {
      // Ignore localStorage errors (e.g. private mode)
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    // Anti-spam: honeypot check
    if (honeypot.trim() !== "") {
      // Silently pretend it worked for bots
      setSuccessMessage("Obrigado! Sua avaliação aparecerá no site após a aprovação.");
      setNome("");
      setCidade("");
      setComentario("");
      setNota(5);
      return;
    }

    // Anti-spam: daily limit per browser
    try {
      const lastSent = localStorage.getItem(STORAGE_KEY);
      if (lastSent) {
        const elapsed = Date.now() - parseInt(lastSent, 10);
        if (elapsed < ONE_DAY_MS) {
          setErrorMessage("Você já enviou uma avaliação hoje. Tente novamente amanhã.");
          setAlreadySubmitted(true);
          return;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    // Validation
    const cleanNome = nome.trim();
    const cleanCidade = cidade.trim();
    const cleanComentario = comentario.trim();

    if (!cleanNome) {
      setErrorMessage("Por favor, preencha o seu nome.");
      return;
    }

    if (!cleanCidade) {
      setErrorMessage("Por favor, informe a sua cidade.");
      return;
    }

    if (!cleanComentario) {
      setErrorMessage("Por favor, escreva o seu comentário.");
      return;
    }

    if (cleanComentario.length > 500) {
      setErrorMessage("O comentário excede o limite de 500 caracteres.");
      return;
    }

    if (nota < 1 || nota > 5) {
      setErrorMessage("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }

    setLoading(true);

    try {
      // Inserção no Supabase SEM usar .select() no final
      const { error } = await supabase.from("avaliacoes").insert({
        nome: cleanNome,
        cidade: cleanCidade,
        nota,
        comentario: cleanComentario,
      });

      if (error) {
        console.warn("Erro ao enviar avaliação:", error.message || error);
        setErrorMessage("Não foi possível enviar sua avaliação no momento. Tente novamente.");
        return;
      }

      // Gravando trava de 1 envio por dia por navegador no localStorage
      try {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setAlreadySubmitted(true);
      } catch {
        // Ignore localStorage error
      }

      // Feedback exato de sucesso e limpeza do formulário
      setSuccessMessage("Obrigado! Sua avaliação aparecerá no site após a aprovação.");
      setNome("");
      setCidade("");
      setComentario("");
      setNota(5);
      setHoverNota(0);

      onSuccess?.();
    } catch (err) {
      console.warn("Erro inesperado ao enviar avaliação:", err);
      setErrorMessage("Ocorreu um erro ao enviar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8 ${className}`}>
      <div className="mb-6 text-center sm:text-left">
        <h3 className="text-xl font-black uppercase tracking-tight text-ink sm:text-2xl">
          Deixe sua avaliação
        </h3>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          Sua opinião é fundamental para nossa comunidade de torcedores.
        </p>
      </div>

      {successMessage ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <p className="mt-3 text-sm font-bold text-green-900">{successMessage}</p>
        </div>
      ) : alreadySubmitted ? (
        <div className="rounded-xl border border-border bg-paper p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-action/10 text-action">
            <CheckCircle2 size={24} />
          </div>
          <p className="mt-3 text-sm font-bold text-ink">
            Você já enviou uma avaliação hoje.
          </p>
          <p className="mt-1 text-xs text-muted">
            Obrigado pelo seu feedback! Para evitar duplicidades, o envio é limitado a 1 por dia.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot anti-spam invisível */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="b_extra_website">Não preencha este campo</label>
            <input
              id="b_extra_website"
              type="text"
              name="b_extra_website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Seletor de estrelas clicáveis de 1 a 5 com hover */}
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-ink">
              Sua nota
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= (hoverNota || nota);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNota(star)}
                    onMouseEnter={() => setHoverNota(star)}
                    onMouseLeave={() => setHoverNota(0)}
                    aria-label={`Avaliar com ${star} estrela${star > 1 ? "s" : ""}`}
                    className="p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action rounded"
                  >
                    <Star
                      size={26}
                      className={
                        isFilled
                          ? "fill-amber-400 text-amber-400"
                          : "text-zinc-300 transition-colors"
                      }
                    />
                  </button>
                );
              })}
              <span className="ml-2 text-xs font-bold tabular-nums text-muted">
                {hoverNota || nota} de 5
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Campo Nome */}
            <div>
              <label htmlFor="avaliacao-nome" className="block text-xs font-bold uppercase tracking-wider text-ink">
                Seu nome *
              </label>
              <input
                id="avaliacao-nome"
                type="text"
                required
                placeholder="Ex: João Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition focus:border-action focus:outline-none focus:ring-1 focus:ring-action"
              />
            </div>

            {/* Campo Cidade */}
            <div>
              <label htmlFor="avaliacao-cidade" className="block text-xs font-bold uppercase tracking-wider text-ink">
                Sua cidade e estado *
              </label>
              <input
                id="avaliacao-cidade"
                type="text"
                required
                placeholder="Ex: São Paulo, SP"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition focus:border-action focus:outline-none focus:ring-1 focus:ring-action"
              />
            </div>
          </div>

          {/* Campo Comentário com Contador de Caracteres */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="avaliacao-comentario" className="block text-xs font-bold uppercase tracking-wider text-ink">
                Seu comentário *
              </label>
              <span
                className={`text-[11px] tabular-nums ${
                  comentario.length >= 480 ? "font-bold text-danger" : "text-muted"
                }`}
              >
                {comentario.length}/500 caracteres
              </span>
            </div>
            <textarea
              id="avaliacao-comentario"
              required
              rows={3}
              maxLength={500}
              placeholder="Conte como foi sua experiência com o produto e a entrega..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-border bg-white p-3 text-sm text-ink placeholder:text-muted/60 transition focus:border-action focus:outline-none focus:ring-1 focus:ring-action"
            />
          </div>

          {/* Mensagem de Erro */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-action py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {loading ? (
              <span>Enviando...</span>
            ) : (
              <>
                <Send size={15} />
                <span>Enviar avaliação</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

