"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/validation";

const baseAccountSchema = z.object({
  name: z.string().optional(),
  email: loginSchema.shape.email,
  password: loginSchema.shape.password,
});
type AccountValues = z.infer<typeof baseAccountSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [sent, setSent] = useState(false);
  const schema = useMemo(() => baseAccountSchema.superRefine((values, context) => {
    if (mode === "register" && (values.name?.trim().length ?? 0) < 3) {
      context.addIssue({ code: "custom", path: ["name"], message: "Informe seu nome completo." });
    }
  }), [mode]);
  const { register, handleSubmit, clearErrors, formState: { errors } } = useForm<AccountValues>({ resolver: zodResolver(schema), mode: "onTouched" });

  return <main className="mx-auto max-w-md px-5 py-12"><div className="rounded-xl border border-border p-6 shadow-card sm:p-8"><p className="text-[10px] font-black uppercase tracking-[.2em] text-blue-600">Bem-vindo à alves store</p><h1 className="mt-2 text-2xl font-black">{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h1><p className="mt-2 text-sm text-muted">Acompanhe seus pedidos e encontre seus favoritos.</p>{sent ? <div role="status" className="mt-6 rounded-lg bg-action-soft p-4 text-sm text-blue-900">Interface demonstrativa: sua solicitação foi validada. A autenticação será integrada em uma próxima etapa.</div> : <form onSubmit={handleSubmit(() => setSent(true))} noValidate className="mt-6 grid gap-4">
    {mode === "register" && <label className="form-label">Nome completo<input {...register("name")} autoComplete="name" aria-invalid={Boolean(errors.name)} className="form-input" placeholder="Como podemos te chamar?" />{errors.name?.message && <span role="alert" className="form-error">{errors.name.message}</span>}</label>}
    <label className="form-label">E-mail<input {...register("email")} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} className="form-input" placeholder="voce@email.com" />{errors.email?.message && <span role="alert" className="form-error">{errors.email.message}</span>}</label>
    <label className="form-label">Senha<input {...register("password")} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} aria-invalid={Boolean(errors.password)} className="form-input" placeholder="Mínimo de 6 caracteres" />{errors.password?.message && <span role="alert" className="form-error">{errors.password.message}</span>}</label>
    <button className="primary-button mt-2 py-3 text-sm font-black uppercase">{mode === "login" ? "Entrar" : "Criar conta"}</button>
  </form>}<button onClick={() => { setSent(false); clearErrors(); setMode(mode === "login" ? "register" : "login"); }} className="mt-5 w-full text-center text-xs font-bold underline">{mode === "login" ? "Ainda não tem conta? Cadastre-se" : "Já tem conta? Entrar"}</button><Link href="/rastreio" className="mt-4 block text-center text-xs text-muted underline">Rastrear pedido sem entrar</Link></div></main>;
}
