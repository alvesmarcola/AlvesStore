"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useForm, type FieldErrors, type Path, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, LockKeyhole, MapPin } from "lucide-react";
import { storeConfig } from "@/config";
import { formatCurrency } from "@/lib/catalog";
import { getCartPricing } from "@/lib/commerce";
import { classifyProduct } from "@/lib/product-classification";
import { getAvailablePatches } from "@/lib/patch-compatibility";
import { useCart } from "@/store/cart";
import { checkoutSchema, type CheckoutValues } from "@/lib/validation";
import { useIsTestPayment } from "./payment-env-context";

const stepFields: Path<CheckoutValues>[][] = [
  ["fullName", "email", "cpf", "phone"],
  ["cep", "street", "number", "complement", "neighborhood", "city", "state"],
];

const stepTitles = ["Identificação", "Endereço", "Pagamento"];

function CheckoutInput({
  label,
  name,
  register,
  errors,
  autoComplete,
  placeholder,
  inputMode,
  maxLength,
  type = "text",
}: {
  label: string;
  name: Path<CheckoutValues>;
  register: UseFormRegister<CheckoutValues>;
  errors: FieldErrors<CheckoutValues>;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  maxLength?: number;
  type?: string;
}) {
  const error = errors[name]?.message;
  return <label className="form-label">
    {label}
    <input {...register(name)} type={type} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} placeholder={placeholder} aria-invalid={Boolean(error)} className={`form-input ${error ? "border-danger" : ""}`} />
    {error && <span role="alert" className="form-error">{String(error)}</span>}
  </label>;
}

export default function CheckoutPage() {
  const isTestPayment = useIsTestPayment();
  const { items } = useCart();
  const [step, setStep] = useState(0);
  const [cepLoading, setCepLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const { subtotal, bundleDiscount, shipping, grandTotal, needsReview } = getCartPricing(items);
  const { register, handleSubmit, trigger, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: { fullName: "", email: "", cpf: "", phone: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" },
  });
  const cep = watch("cep");

  async function nextStep() {
    const valid = await trigger(stepFields[step] ?? [], { shouldFocus: true });
    if (!valid) return;
    setStep((current) => Math.min(current + 1, stepTitles.length - 1));
  }

  async function lookupCep() {
    const normalizedCep = cep.replace(/\D/g, "");
    if (normalizedCep.length !== 8) {
      setError("cep", { type: "manual", message: "Informe um CEP com 8 números." });
      return;
    }

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
      if (!response.ok) throw new Error("Consulta indisponível.");
      const address = await response.json();
      if (address.erro) {
        setError("cep", { type: "manual", message: "CEP não encontrado. Confira os números." });
        return;
      }
      setValue("street", address.logradouro ?? "", { shouldValidate: true });
      setValue("neighborhood", address.bairro ?? "", { shouldValidate: true });
      setValue("city", address.localidade ?? "", { shouldValidate: true });
      setValue("state", address.uf ?? "", { shouldValidate: true });
    } catch {
      setError("cep", { type: "manual", message: "Não foi possível consultar o CEP. Preencha o endereço manualmente." });
      return;
    } finally {
      setCepLoading(false);
    }
  }

  async function placeOrder(values: CheckoutValues) {
    setCheckoutError("");
    idempotencyKey.current ??= globalThis.crypto.randomUUID();
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey.current,
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          items: items.map((item) => ({
            productId: item.product.id,
            size: item.size,
            quantity: item.quantity,
            ...(item.customization ? { customization: item.customization } : {}),
            ...(item.patches?.length ? { patches: item.patches } : {}),
          })),
          customer: values,
        }),
      });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Não foi possível iniciar o pagamento.");
      if (!result.checkoutUrl || !result.checkoutUrl.startsWith("https://")) {
        throw new Error("O servidor não retornou um link seguro do Checkout Pro.");
      }
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Não foi possível iniciar o pagamento. Tente novamente.");
    }
  }

  if (!items.length) return <main className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-2xl font-black">Sua sacola está vazia</h1><p className="mt-2 text-sm text-muted">Adicione uma camisa antes de continuar.</p><Link href="/masculino" className="primary-button mt-5 inline-block px-6 py-3 text-xs font-black uppercase">Explorar camisas</Link></main>;
  if (needsReview) return <main className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-2xl font-black">Há um preço para confirmar</h1><p className="mt-3 text-sm leading-6 text-muted">Um produto da sacola ainda está em revisão. Remova-o ou escolha outro modelo para continuar.</p><Link href="/carrinho" className="primary-button mt-5 inline-block px-6 py-3 text-xs font-black uppercase">Revisar sacola</Link></main>;

  return <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <div className="mb-7"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700"><LockKeyhole size={14} />Checkout seguro · Mercado Pago</p><h1 className="mt-2 text-3xl font-black">Finalizar compra</h1><p className="mt-1 text-sm text-muted">Informe seus dados e conclua o pagamento no ambiente seguro do Mercado Pago.</p>{isTestPayment && <p className="mt-2 text-xs font-semibold text-amber-700">Ambiente de teste: as transações não são cobranças reais.</p>}</div>
    <div className="mb-6 grid grid-cols-3 gap-2" aria-label="Etapas do checkout">
      {stepTitles.map((title, index) => <div key={title} className={`border-t-2 pt-2 text-xs font-bold ${index <= step ? "border-action text-ink" : "border-border text-muted"}`} aria-current={step === index ? "step" : undefined}>{index + 1}. {title}</div>)}
    </div>
    <form onSubmit={handleSubmit(placeOrder)} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <section hidden={step !== 0} className="rounded-xl border border-border p-5 sm:p-7"><h2 className="text-lg font-black">1. Seus dados</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><CheckoutInput label="Nome completo" name="fullName" register={register} errors={errors} autoComplete="name" placeholder="Seu nome" /></div>
          <CheckoutInput label="E-mail" name="email" register={register} errors={errors} autoComplete="email" placeholder="voce@email.com" type="email" />
          <CheckoutInput label="CPF" name="cpf" register={register} errors={errors} inputMode="numeric" maxLength={14} placeholder="000.000.000-00" />
          <CheckoutInput label="Celular com DDD" name="phone" register={register} errors={errors} autoComplete="tel" inputMode="tel" maxLength={15} placeholder="(00) 00000-0000" />
        </div><button type="button" onClick={nextStep} className="primary-button mt-6 flex items-center gap-2 px-5 py-3 text-xs font-black uppercase">Continuar <ChevronRight size={15} /></button></section>
        <section hidden={step !== 1} className="rounded-xl border border-border p-5 sm:p-7"><h2 className="text-lg font-black">2. Endereço e frete</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-2"><div className="flex-1"><CheckoutInput label="CEP" name="cep" register={register} errors={errors} autoComplete="postal-code" inputMode="numeric" maxLength={9} placeholder="00000-000" /></div><button type="button" onClick={lookupCep} disabled={cepLoading} aria-label="Buscar endereço pelo CEP" className="mb-[1px] grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border disabled:opacity-50">{cepLoading ? <span className="animate-spin">◌</span> : <MapPin size={17} />}</button></div>
          <CheckoutInput label="Estado (UF)" name="state" register={register} errors={errors} autoComplete="address-level1" maxLength={2} placeholder="SP" />
          <div className="sm:col-span-2"><CheckoutInput label="Endereço" name="street" register={register} errors={errors} autoComplete="street-address" placeholder="Rua, avenida..." /></div>
          <CheckoutInput label="Número" name="number" register={register} errors={errors} placeholder="Número" />
          <CheckoutInput label="Complemento (opcional)" name="complement" register={register} errors={errors} placeholder="Apto, bloco" />
          <CheckoutInput label="Bairro" name="neighborhood" register={register} errors={errors} placeholder="Bairro" />
          <CheckoutInput label="Cidade" name="city" register={register} errors={errors} autoComplete="address-level2" placeholder="Cidade" />
        </div>
        <p className="mt-4 rounded bg-action-soft p-3 text-xs leading-5 text-blue-900">Frete: {shipping === 0 ? "Grátis" : formatCurrency(shipping)}. A busca do CEP serve apenas para preencher o endereço.</p>
        <div className="mt-6 flex gap-2"><button type="button" onClick={() => setStep(0)} className="flex items-center gap-2 rounded-lg border border-ink px-5 py-3 text-xs font-black uppercase"><ChevronLeft size={15} /> Voltar</button><button type="button" onClick={nextStep} disabled={cepLoading} className="primary-button flex items-center gap-2 px-5 py-3 text-xs font-black uppercase disabled:opacity-50">Continuar <ChevronRight size={15} /></button></div></section>
        <section hidden={step !== 2} className="rounded-xl border border-border p-5 sm:p-7"><h2 className="text-lg font-black">3. Pagamento</h2><div className="mt-4 rounded-lg border border-action/30 bg-action-soft p-4"><p className="text-sm font-black">Checkout Pro Mercado Pago</p><p className="mt-1 text-xs leading-5 text-muted">Você será redirecionado ao ambiente seguro do Mercado Pago. Os meios de pagamento disponíveis serão exibidos lá.</p>{isTestPayment && <p className="mt-2 text-xs font-bold text-blue-900">Integração em modo de teste; nenhuma cobrança real será realizada.</p>}</div>
          {checkoutError && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{checkoutError}</p>}
          <div className="mt-6 flex gap-2"><button type="button" onClick={() => setStep(1)} disabled={isSubmitting} className="flex items-center gap-2 rounded-lg border border-ink px-5 py-3 text-xs font-black uppercase disabled:opacity-50"><ChevronLeft size={15} /> Voltar</button><button type="submit" disabled={isSubmitting} className="primary-button flex items-center gap-2 px-5 py-3 text-xs font-black uppercase disabled:opacity-50">{isSubmitting ? "Preparando pagamento..." : "Ir ao Mercado Pago"} {!isSubmitting && <ChevronRight size={15} />}</button></div>
        </section>
      </div>
      <aside className="h-fit rounded-xl border border-border p-5"><h2 className="text-lg font-black">Resumo do pedido</h2>{items.map((item) => { const unitPrice = classifyProduct(item.product).price ?? 0; const patchPrice = (item.patches ?? []).reduce((sum, selected) => sum + (getAvailablePatches(item.product).find((patch) => patch.id === selected.id)?.priceCents ?? 0), 0) / 100; return <div key={item.lineId} className="mt-4 flex justify-between gap-3 text-xs"><span className="flex-1">{item.product.nome} · tam. {item.size} × {item.quantity}{item.customization ? " · personalizada" : ""}{item.patches?.length ? ` · ${item.patches.length} patch(es)` : ""}</span><span>{formatCurrency((unitPrice + patchPrice + (item.customization ? storeConfig.customizationPrice : 0)) * item.quantity)}</span></div>; })}<div className="mt-5 space-y-2 border-t border-border pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>{bundleDiscount > 0 && <div className="flex justify-between text-success"><span>Oferta por quantidade</span><span>-{formatCurrency(bundleDiscount)}</span></div>}<div className="flex justify-between"><span>Frete</span><span>{shipping === 0 ? "Grátis" : formatCurrency(shipping)}</span></div><div className="flex justify-between border-t border-border pt-3 text-lg font-black"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div></div><p className="mt-4 text-[10px] leading-4 text-muted">O servidor confere produtos, patches, preços e frete antes de criar o pagamento.</p></aside>
    </form>
  </main>;
}
