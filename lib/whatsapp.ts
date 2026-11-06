import { siteCompanyConfig } from "@/lib/site-config";

export const WHATSAPP_PHONE = siteCompanyConfig.whatsapp || "555499968814";

export function whatsappLink(message: string) {
  const phone = siteCompanyConfig.whatsapp || WHATSAPP_PHONE;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
