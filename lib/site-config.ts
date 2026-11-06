/**
 * Configurações institucionais da empresa e atendimento.
 * Valores lidos prioritariamente de variáveis de ambiente com fallbacks definidos.
 */
export const siteCompanyConfig = {
  razaoSocial: process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "",
  cnpj: process.env.NEXT_PUBLIC_COMPANY_CNPJ?.trim() || "",
  endereco: process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || "",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL?.trim() || "atendimento@importsalves.com.br",
  whatsapp: process.env.NEXT_PUBLIC_COMPANY_WHATSAPP?.trim() || "555499968814",
  whatsappDisplay: process.env.NEXT_PUBLIC_COMPANY_WHATSAPP_DISPLAY?.trim() || "(54) 99968-8114",
  horarioAtendimento: process.env.NEXT_PUBLIC_COMPANY_HOURS?.trim() || "Segunda a Sexta, das 9h às 18h",
  prazoEstimadoEntrega: process.env.NEXT_PUBLIC_DELIVERY_ESTIMATE?.trim() || process.env.NEXT_PUBLIC_COMPANY_DELIVERY_TIME?.trim() || "",
};

export type SiteCompanyConfig = typeof siteCompanyConfig;

