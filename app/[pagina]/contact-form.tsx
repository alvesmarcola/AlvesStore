"use client";

import { SITE_NAME } from "@/lib/site";

export function ContactForm({ email }: { email: string }) {
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const subject = encodeURIComponent(`Atendimento ${SITE_NAME} — ${data.get("name")}`);
    const body = encodeURIComponent(`Nome: ${data.get("name")}\nE-mail: ${data.get("email")}\n\n${data.get("message")}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  }
  return <form onSubmit={submit} className="mt-7 grid gap-4 rounded-xl border p-5"><label className="text-xs font-bold">Nome<input name="name" required maxLength={100} className="mt-1 w-full min-h-[44px] rounded border px-3 py-2.5 text-base sm:text-sm" /></label><label className="text-xs font-bold">E-mail<input name="email" required type="email" maxLength={120} className="mt-1 w-full min-h-[44px] rounded border px-3 py-2.5 text-base sm:text-sm" /></label><label className="text-xs font-bold">Mensagem<textarea name="message" required maxLength={3000} rows={5} className="mt-1 w-full min-h-[88px] rounded border px-3 py-2.5 text-base sm:text-sm" /></label><button className="primary-button min-h-[44px] px-5 py-3 text-xs font-bold uppercase">Preparar mensagem por e-mail</button></form>;
}
