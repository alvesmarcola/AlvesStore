import { z } from "zod";

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calculateDigit = (length: number) => {
    let total = 0;
    for (let index = 0; index < length; index += 1) {
      total += Number(cpf[index]) * (length + 1 - index);
    }
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
}

export const checkoutSchema = z.object({
  whatsappUpdates: z.boolean(),
  fullName: z.string().trim().min(3, "Informe seu nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  cpf: z.string().refine(isValidCpf, "Informe um CPF válido."),
  phone: z.string().refine((value) => {
    const phone = digits(value);
    return phone.length === 10 || phone.length === 11;
  }, "Informe um telefone com DDD válido."),
  cep: z.string().refine((value) => digits(value).length === 8, "Informe um CEP com 8 números."),
  street: z.string().trim().min(3, "Informe o endereço."),
  number: z.string().trim().min(1, "Informe o número."),
  complement: z.string(),
  neighborhood: z.string().trim().min(2, "Informe o bairro."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z.string().trim().length(2, "Informe a UF com 2 letras."),
});

export type CheckoutValues = z.infer<typeof checkoutSchema>;

export const trackingSchema = z.object({
  code: z.string().trim().min(5, "Digite um código de pedido válido."),
});

export const newsletterSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
});
