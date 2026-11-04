"use client";

import { useCallback, useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { SITE_NAME } from "@/lib/site";
import { AdminSkeleton, ErrorState, LockedState } from "@/components/admin-states";

type FrameStatus = "checking" | "locked" | "authenticated";

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<FrameStatus>("checking");
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState("");

  const expireSession = useCallback(() => {
    setExpired(true);
    setMessage("Sua sessão expirou. Entre novamente.");
    setStatus("locked");
  }, []);

  useEffect(() => {
    let active = true;
    const handleExpired = () => expireSession();
    window.addEventListener("admin-session-expired", handleExpired);
    void fetch("/api/admin/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          setStatus("authenticated");
          return;
        }
        setStatus("locked");
        if (response.status !== 401) {
          const body = await response.json().catch(() => ({})) as { error?: string };
          setMessage(body.error ?? "Não foi possível verificar o acesso administrativo.");
        }
      })
      .catch(() => {
        if (!active) return;
        setStatus("locked");
        setMessage("Não foi possível verificar o acesso administrativo.");
      });
    return () => {
      active = false;
      window.removeEventListener("admin-session-expired", handleExpired);
    };
  }, [expireSession]);

  async function logout() {
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
      setExpired(false);
      setStatus("locked");
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível encerrar a sessão.");
    }
  }

  if (status === "checking") {
    return <main id="admin-shell" className="mx-auto min-h-[100dvh] max-w-7xl px-4 py-6 sm:px-6"><AdminSkeleton cards={2} /></main>;
  }

  if (status === "locked") {
    return (
      <main id="admin-shell" className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
        <header className="border-b border-border pb-4">
          <p className="text-sm font-black">{SITE_NAME}</p>
          <p className="mt-1 text-xs text-muted">Administração</p>
        </header>
        {message && !expired
          ? <div className="mt-8"><ErrorState message={message} onRetry={() => window.location.reload()} /></div>
          : <LockedState
            message={expired ? "Sua sessão expirou. Entre novamente." : undefined}
            onAuthenticated={() => { setMessage(""); setExpired(false); setStatus("authenticated"); }}
          />}
      </main>
    );
  }

  return (
    <div id="admin-shell" className="min-h-[100dvh] overflow-x-clip pb-[env(safe-area-inset-bottom)]">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="break-words text-sm font-black">{SITE_NAME}</p>
            <p className="text-xs text-muted">Administração</p>
          </div>
          <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border px-4 text-sm font-bold hover:bg-paper">
            <LogOut size={16} />Sair
          </button>
        </div>
      </header>
      {message && <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8"><p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p></div>}
      {children}
    </div>
  );
}
