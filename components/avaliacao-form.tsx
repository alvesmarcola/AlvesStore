"use client";

import React, { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Star, Send, CheckCircle2, AlertCircle, Camera, Trash2 } from "lucide-react";
import { compressReviewImage, MAX_ORIGINAL_FILE_SIZE } from "@/lib/client/image-compression";

const STORAGE_KEY = "imports_alves_review_last_sent";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface AvaliacaoFormProps {
  onSuccess?: () => void;
  className?: string;
}

export function AvaliacaoForm({ onSuccess, className = "" }: AvaliacaoFormProps) {
  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [produto, setProduto] = useState("");
  const [comentario, setComentario] = useState("");
  const [nota, setNota] = useState(5);
  const [hoverNota, setHoverNota] = useState(0);
  const [honeypot, setHoneypot] = useState("");

  // Estado da foto opcional
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoSizeInfo, setPhotoSizeInfo] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Limpeza de URLs temporárias de prévia ao desmontar
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Trava anti-spam via localStorage: 1 envio por dia por navegador
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
      // Ignora erro de acesso ao localStorage (ex: navegação anônima restrita)
    }
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    setErrorMessage(null);
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validação de tipo de arquivo
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError("Formato inválido. Selecione uma imagem em JPG, PNG ou WebP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Validação de limite máximo original (8 MB)
    if (file.size > MAX_ORIGINAL_FILE_SIZE) {
      setPhotoError("A imagem selecionada excede o limite máximo de 8 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsCompressing(true);
    try {
      // Comprime no navegador: redimensiona para no máx 1200px, WebP ~0.8, meta < 300 KB, descarta EXIF/GPS
      const compressed = await compressReviewImage(file);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      const previewUrl = URL.createObjectURL(compressed);

      setSelectedPhoto(compressed);
      setPhotoPreview(previewUrl);
      setPhotoSizeInfo(`${(compressed.size / 1024).toFixed(0)} KB · WebP (privacidade protegida)`);
    } catch (err) {
      console.warn("Falha na compressão da imagem:", err);
      setPhotoError(err instanceof Error ? err.message : "Não foi possível processar a imagem selecionada.");
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setPhotoSizeInfo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsCompressing(false);
    }
  }

  function handleRemovePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setPhotoSizeInfo(null);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    // Anti-spam leve: checagem do honeypot invisível
    if (honeypot.trim() !== "") {
      // Simula sucesso silencioso para bots
      setSuccessMessage("Sua avaliação foi enviada e aparecerá após aprovação");
      setNome("");
      setCidade("");
      setComentario("");
      setNota(5);
      handleRemovePhoto();
      return;
    }

    // Anti-spam leve: trava de 1 envio por dia por navegador
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
      // Ignora erro de localStorage
    }

    // Validação dos campos obrigatórios
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
      setErrorMessage("O comentário excede o limite máximo de 500 caracteres.");
      return;
    }

    if (nota < 1 || nota > 5) {
      setErrorMessage("Por favor, selecione uma nota de 1 a 5 estrelas.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("nome", cleanNome);
      formData.append("cidade", cleanCidade);
      if (produto.trim()) formData.append("produto", produto.trim());
      formData.append("nota", String(nota));
      formData.append("comentario", cleanComentario);
      formData.append("website", honeypot);
      if (selectedPhoto) {
        formData.append("foto", selectedPhoto);
      }

      const response = await fetch("/api/reviews", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível enviar sua avaliação no momento.");
      }

      // Gravando trava de 1 envio por dia por navegador no localStorage
      try {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setAlreadySubmitted(true);
      } catch {
        // Ignora erro de localStorage
      }

      // Feedback de sucesso e limpeza completa do formulário
      setSuccessMessage("Sua avaliação foi enviada e aparecerá após aprovação");
      setNome("");
      setCidade("");
      setProduto("");
      setComentario("");
      setNota(5);
      setHoverNota(0);
      handleRemovePhoto();

      onSuccess?.();
    } catch (err) {
      console.warn("Erro ao enviar avaliação:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro ao enviar. Verifique sua conexão e tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 ${className}`}>
      <div className="mb-6 text-center sm:text-left">
        <h3 className="text-xl font-bold uppercase tracking-normal text-zinc-950 sm:text-2xl">
          Deixe sua avaliação
        </h3>
        <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
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
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white">
            <CheckCircle2 size={20} />
          </div>
          <p className="mt-3 text-sm font-bold text-zinc-900">
            Você já enviou uma avaliação hoje.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Obrigado pelo seu feedback! Para evitar duplicidades, o envio é limitado a 1 por dia.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot anti-spam invisível para bots */}
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

          {/* Seletor de estrelas clicáveis de 1 a 5 com efeito visual de hover */}
          <div>
            <label htmlFor="avaliacao-produto" className="block text-xs font-bold uppercase tracking-wider text-zinc-900">
              Produto avaliado (opcional)
            </label>
            <input
              id="avaliacao-produto"
              type="text"
              maxLength={120}
              placeholder="Ex.: camisa do seu time"
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-zinc-900">
              Sua nota *
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
                    className="p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 rounded"
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
              <span className="ml-2 text-xs font-bold tabular-nums text-zinc-500">
                {hoverNota || nota} de 5
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Campo Nome */}
            <div>
              <label htmlFor="avaliacao-nome" className="block text-xs font-bold uppercase tracking-wider text-zinc-900">
                Seu nome *
              </label>
              <input
                id="avaliacao-nome"
                type="text"
                required
                placeholder="Ex: João Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>

            {/* Campo Cidade */}
            <div>
              <label htmlFor="avaliacao-cidade" className="block text-xs font-bold uppercase tracking-wider text-zinc-900">
                Sua cidade e estado *
              </label>
              <input
                id="avaliacao-cidade"
                type="text"
                required
                placeholder="Ex: São Paulo, SP"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          {/* Campo Comentário com Contador Visível de Caracteres */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="avaliacao-comentario" className="block text-xs font-bold uppercase tracking-wider text-zinc-900">
                Seu comentário *
              </label>
              <span
                className={`text-[11px] tabular-nums ${
                  comentario.length >= 480 ? "font-bold text-red-600" : "text-zinc-500"
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
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 bg-zinc-50/50 p-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          {/* Campo Foto (opcional) */}
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 p-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-900">
                Foto (opcional)
              </label>
              <span className="text-[11px] text-zinc-500">Máx. 1 foto (JPG, PNG, WebP)</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Mostre a sua camisa ou pacote recebido. A foto é comprimida automaticamente e seus dados de localização são removidos.
            </p>

            <input
              ref={fileInputRef}
              id="avaliacao-foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Escolher foto da avaliação"
              disabled={loading || isCompressing}
            />

            {!photoPreview ? (
              <div className="mt-3">
                <label
                  htmlFor="avaliacao-foto"
                  className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-800 transition hover:bg-zinc-100 hover:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-900 shadow-sm ${
                    isCompressing ? "opacity-60 cursor-wait" : ""
                  }`}
                >
                  <Camera size={16} className="text-zinc-700" />
                  <span>{isCompressing ? "Otimizando foto..." : "Tirar foto ou escolher da galeria"}</span>
                </label>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                <img
                  src={photoPreview}
                  alt="Prévia da foto selecionada"
                  className="h-14 w-14 rounded-md object-cover border border-zinc-200"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-bold text-zinc-900 truncate">Foto anexada com sucesso</p>
                  <p className="text-[11px] text-zinc-500">{photoSizeInfo || "Pronta para envio"}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={loading}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 transition"
                  aria-label="Remover foto selecionada"
                >
                  <Trash2 size={14} />
                  <span>Remover</span>
                </button>
              </div>
            )}

            {photoError && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {photoError}
              </p>
            )}

            <p className="mt-2.5 text-[11px] text-zinc-500 leading-relaxed">
              Ao enviar a foto, você autoriza a exibição dela no site da Imports Alves. Você pode pedir a remoção a qualquer momento pelo WhatsApp.
            </p>
          </div>

          {/* Mensagem de Erro Geral */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botão de Envio no padrão dark/zinc da loja */}
          <button
            type="submit"
            disabled={loading || isCompressing}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-zinc-800 hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8 shadow-sm"
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
