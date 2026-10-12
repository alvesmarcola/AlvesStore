"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm, type FieldErrors, type Path, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, LockKeyhole, MapPin } from "lucide-react";
import { storeConfig } from "@/config";
import { formatCurrency } from "@/lib/catalog";
import { getCartPricing, qualifiesForFreeShipping } from "@/lib/commerce";
import { useCart } from "@/store/cart";
import { checkoutSchema, type CheckoutValues } from "@/lib/validation";

const stepFields: Path<CheckoutValues>[][] = [
  ["fullName", "email", "cpf", "phone"],
  ["cep", "street", "number", "complement", "neighborhood", "city", "state"],
  ["payment"],
];

const stepTitles = ["Identificação", "Endereço e frete", "Pagamento"];

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
  const { items, coupon } = useCart();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [shipping, setShipping] = useState<"pac" | "express">("pac");
  const { subtotal, couponDiscount, bundleDiscount, totalDiscount } = getCartPricing(items, coupon);
  const { register, handleSubmit, trigger, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onTouched",
    defaultValues: { fullName: "", email: "", cpf: "", phone: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", payment: "pix" },
  });
  const payment = watch("payment");
  const freeShipping = qualifiesForFreeShipping(items);
  const freight = freeShipping ? 0 : shipping === "pac" ? 19.9 : 29.9;
  const beforePaymentDiscount = subtotal - totalDiscount + freight;
  const total = payment === "pix" ? beforePaymentDiscount * (1 - storeConfig.pixDiscount) : beforePaymentDiscount;
  const hasUnavailableItems = items.some((item) => item.product.estoque < item.quantity);

  async function nextStep() {
    const valid = await trigger(stepFields[step], { shouldFocus: true });
    if (valid) setStep((current) => Math.min(current + 1, stepTitles.length - 1));
  }

  async function lookupCep() {
    const cep = watch("cep").replace(/\D/g, "");
    if (cep.length !== 8) {
      setError("cep", { type: "manual", message: "Informe um CEP com 8 números." });
      return;
    }
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
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
    } finally {
      setCepLoading(false);
    }
  }

  function placeOrder() {
    setSubmitted(true);
  }

  if (!items.length) return <main className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-2xl font-black">Sua sacola está vazia</h1><p className="mt-2 text-sm text-muted">Adicione uma camisa antes de continuar.</p><Link href="/masculino" className="primary-button mt-5 inline-block px-6 py-3 text-xs font-black uppercase">Explorar camisas</Link></main>;
  if (submitted) return <main className="mx-auto max-w-xl px-5 py-20 text-center"><CheckCircle2 size={50} className="mx-auto text-success" /><h1 className="mt-4 text-3xl font-black">Pedido de demonstração recebido!</h1><p className="mt-3 text-sm leading-6 text-muted">Esta loja é uma interface demonstrativa. Nenhum pagamento foi processado nem pedido enviado. O checkout está preparado para integração futura.</p><button className="mt-6 rounded-lg bg-ink px-6 py-3 text-xs font-black uppercase text-white" onClick={() => router.push("/")}>Voltar à loja</button></main>;

  return <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
    <div className="mb-7"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700"><LockKeyhole size={14} />Checkout seguro · ambiente demonstrativo</p><h1 className="mt-2 text-3xl font-black">Finalizar compra</h1><p className="mt-1 text-sm text-muted">Preencha seus dados para simular seu pedido.</p></div>
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
        <section hidden={step !== 1} className="rounded-xl border border-border p-5 sm:p-7"><h2 className="text-lg font-black">2. Endereço de entrega</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-2"><div className="flex-1"><CheckoutInput label="CEP" name="cep" register={register} errors={errors} autoComplete="postal-code" inputMode="numeric" maxLength={9} placeholder="00000-000" /></div><button type="button" onClick={lookupCep} disabled={cepLoading} aria-label="Consultar CEP" className="mb-[1px] grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border disabled:opacity-50">{cepLoading ? <span className="animate-spin">◌</span> : <MapPin size={17} />}</button></div>
          <CheckoutInput label="Estado (UF)" name="state" register={register} errors={errors} autoComplete="address-level1" maxLength={2} placeholder="SP" />
          <div className="sm:col-span-2"><CheckoutInput label="Endereço" name="street" register={register} errors={errors} autoComplete="street-address" placeholder="Rua, avenida..." /></div>
          <CheckoutInput label="Número" name="number" register={register} errors={errors} placeholder="Número" />
          <CheckoutInput label="Complemento (opcional)" name="complement" register={register} errors={errors} placeholder="Apto, bloco" />
          <CheckoutInput label="Bairro" name="neighborhood" register={register} errors={errors} placeholder="Bairro" />
          <CheckoutInput label="Cidade" name="city" register={register} errors={errors} autoComplete="address-level2" placeholder="Cidade" />
        </div>
        <h3 className="mt-6 text-sm font-black">Escolha o frete</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4"><input type="radio" name="shipping" checked={shipping === "pac"} onChange={() => setShipping("pac")} /><span className="flex-1 text-xs"><strong className="block">PAC · 6–9 dias úteis</strong><span className="text-muted">Entrega econômica</span></span><b className="text-xs">{freeShipping ? "Grátis" : formatCurrency(19.9)}</b></label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-4"><input type="radio" name="shipping" checked={shipping === "express"} onChange={() => setShipping("express")} /><span className="flex-1 text-xs"><strong className="block">Expresso · 2–4 dias úteis</strong><span className="text-muted">Mais rapidez</span></span><b className="text-xs">{freeShipping ? "Grátis" : formatCurrency(29.9)}</b></label>
        </div>
        <p className="mt-3 rounded bg-action-soft p-3 text-xs leading-5 text-blue-900">Prazo e frete são estimativas desta demonstração. Serão atualizados com o serviço de logística na integração.</p>
        <div className="mt-6 flex gap-2"><button type="button" onClick={() => setStep(0)} className="flex items-center gap-2 rounded-lg border border-ink px-5 py-3 text-xs font-black uppercase"><ChevronLeft size={15} /> Voltar</button><button type="button" onClick={nextStep} className="primary-button flex items-center gap-2 px-5 py-3 text-xs font-black uppercase">Continuar <ChevronRight size={15} /></button></div></section>
        <section hidden={step !== 2} className="rounded-xl border border-border p-5 sm:p-7"><h2 className="text-lg font-black">3. Forma de pagamento</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${payment === "pix" ? "border-action bg-action-soft" : "border-border"}`}><input type="radio" value="pix" {...register("payment")} /><span><strong className="block text-sm">Pix</strong><small className="mt-1 block text-xs text-blue-700">{storeConfig.pixDiscount * 100}% de desconto</small></span></label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${payment === "card" ? "border-action bg-action-soft" : "border-border"}`}><input type="radio" value="card" {...register("payment")} /><span><strong className="block text-sm">Cartão</strong><small className="mt-1 block text-xs text-muted">Até {storeConfig.installments}x sem juros</small></span></label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${payment === "boleto" ? "border-action bg-action-soft" : "border-border"}`}><input type="radio" value="boleto" {...register("payment")} /><span><strong className="block text-sm">Boleto</strong><small className="mt-1 block text-xs text-muted">Vencimento em 2 dias</small></span></label>
        </div><p className="mt-4 rounded bg-paper p-3 text-xs leading-5 text-muted">Demonstração: nenhuma cobrança será realizada. A integração com Mercado Pago, Stripe ou Pix poderá ser configurada nesta etapa no futuro.</p>{hasUnavailableItems && <p role="alert" className="mt-3 text-xs font-semibold text-danger">Há produtos sem estoque na sacola. Volte à sacola para removê-los antes de concluir.</p>}<div className="mt-6 flex gap-2"><button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 rounded-lg border border-ink px-5 py-3 text-xs font-black uppercase"><ChevronLeft size={15} /> Voltar</button><button disabled={isSubmitting || hasUnavailableItems} className="primary-button px-5 py-3 text-xs font-black uppercase disabled:opacity-50">Concluir pedido demonstrativo</button></div></section>
      </div>
      <aside className="h-fit rounded-xl border border-border p-5"><h2 className="text-lg font-black">Resumo do pedido</h2>{items.map((item) => <div key={item.lineId} className="mt-4 flex justify-between gap-3 text-xs"><span className="flex-1">{item.product.clube} · tam. {item.size} × {item.quantity}</span><span>{formatCurrency((storeConfig.shirtPrice + (item.customization ? storeConfig.customizationPrice : 0)) * item.quantity)}</span></div>)}<div className="mt-5 space-y-2 border-t border-border pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>{couponDiscount > 0 && <div className="flex justify-between text-success"><span>Cupom aplicado</span><span>-{formatCurrency(couponDiscount)}</span></div>}{bundleDiscount > 0 && <div className="flex justify-between text-success"><span>Desconto nos pacotes</span><span>-{formatCurrency(bundleDiscount)}</span></div>}<div className="flex justify-between"><span>Frete</span><span>{freight === 0 ? "Grátis" : formatCurrency(freight)}</span></div><div className="flex justify-between border-t border-border pt-3 text-lg font-black"><span>Total {payment === "pix" ? "no Pix" : ""}</span><span>{formatCurrency(total)}</span></div>{payment !== "pix" && <p className="text-right text-xs text-muted">ou {storeConfig.installments}x de {formatCurrency(total / storeConfig.installments)} sem juros</p>}</div><p className="mt-4 text-[10px] leading-4 text-muted">Ao continuar, você concorda com nossos termos de compra e política de privacidade.</p></aside>
    </form>
  </main>;
}
