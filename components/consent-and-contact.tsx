"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { storeConfig } from "@/config";

export function ConsentAndContact() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(localStorage.getItem("a90-cookie-consent") !== "accepted"), []);
  return <>
    <a href={`https://wa.me/${storeConfig.whatsapp}?text=${encodeURIComponent(storeConfig.whatsappMessage)}`} target="_blank" rel="noreferrer" className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-lg" aria-label="Fale conosco pelo WhatsApp"><MessageCircle size={26} /></a>
    {visible && <div className="fixed bottom-14 left-0 right-0 z-50 flex flex-col gap-3 border-t bg-white p-4 shadow-lg sm:bottom-0 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p className="max-w-3xl text-xs leading-5 text-muted">Usamos cookies para melhorar sua experiência. Ao continuar navegando, você concorda com nossa <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p><button onClick={() => { localStorage.setItem("a90-cookie-consent", "accepted"); setVisible(false); }} className="rounded bg-pitch px-5 py-2.5 text-xs font-black uppercase text-white">Entendi</button></div>}
  </>;
}
