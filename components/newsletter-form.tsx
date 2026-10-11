"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newsletterSchema } from "@/lib/validation";

type NewsletterValues = { email: string };

export function NewsletterForm() {
  const [subscribed, setSubscribed] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<NewsletterValues>({ resolver: zodResolver(newsletterSchema), mode: "onTouched" });
  if (subscribed) return <p role="status" className="rounded-lg bg-white px-4 py-3 text-sm font-bold text-ink">Valeu! Você está na lista da torcida. (Demonstração)</p>;
  return <form onSubmit={handleSubmit(() => setSubscribed(true))} noValidate className="mt-5 w-full max-w-md sm:mt-0">
    <div className="flex gap-2"><label htmlFor="newsletter-email" className="sr-only">Seu e-mail</label><input id="newsletter-email" {...register("email")} type="email" placeholder="Seu melhor e-mail" aria-invalid={Boolean(errors.email)} className="min-w-0 flex-1 rounded-lg bg-white px-4 py-3 text-sm text-ink outline-none" /> <button className="primary-button px-4 text-xs font-black uppercase">Quero receber</button></div>
    {errors.email?.message && <span role="alert" className="mt-2 block text-xs text-white">{errors.email.message}</span>}
  </form>;
}
