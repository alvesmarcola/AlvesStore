"use client";

import { createContext, useContext } from "react";

const PaymentEnvironmentContext = createContext(false);
export function PaymentEnvironmentProvider({ isTest, children }: { isTest: boolean; children: React.ReactNode }) {
  return <PaymentEnvironmentContext.Provider value={isTest}>{children}</PaymentEnvironmentContext.Provider>;
}
export function useIsTestPayment() { return useContext(PaymentEnvironmentContext); }
