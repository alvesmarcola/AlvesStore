"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackageCheck } from "lucide-react";
import { trackingSchema } from "@/lib/validation";

type TrackingValues = { code: string };

export default function TrackingPage() {
  const [searchedCode, setSearchedCode] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm<TrackingValues>({ resolver: zodResolver(trackingSchema), mode: "onTouched" });

  return <main className="mx-auto max-w-2xl px-5 py-12"><div className="rounded-xl border border-border p-6 sm:p-9"><span className="grid h-12 w-12 place-items-center rounded-full bg-action-soft text-blue-700"><PackageCheck /></span><h1 className="mt-4 text-3xl font-black">Rastreie seu pedido</h1><p className="mt-2 text-sm leading-6 text-muted">Digite o código de rastreio enviado para o seu e-mail para consultar a entrega.</p><form onSubmit={handleSubmit(({ code }) => setSearchedCode(code.trim().toUpperCase()))} noValidate className="mt-6 flex gap-2"><label className="sr-only" htmlFor="tracking-code">Código do pedido</label><input id="tracking-code" {...register("code")} placeholder="Ex.: ALS-123456" aria-invalid={Boolean(errors.code)} className="min-w-0 flex-1 rounded-lg border border-border px-4 py-3 text-sm" /><button className="rounded-lg bg-ink px-5 text-xs font-black uppercase text-white transition hover:bg-graphite-hover">Buscar</button></form>{errors.code?.message && <p role="alert" className="form-error">{errors.code.message}</p>}{searchedCode && <div role="status" className="mt-6 rounded-lg bg-paper p-5"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Pedido {searchedCode} · demonstração</p><ol className="mt-4 space-y-4 border-l-2 border-action pl-4"><li><p className="text-sm font-bold">Pedido confirmado</p><p className="mt-1 text-xs text-muted">Pagamento aprovado. Seu pedido está em preparação.</p></li><li><p className="text-sm font-bold">Preparando para envio</p><p className="mt-1 text-xs text-muted">Atualização mockada — conecte o rastreio real no backend.</p></li></ol></div>}</div></main>;
}
