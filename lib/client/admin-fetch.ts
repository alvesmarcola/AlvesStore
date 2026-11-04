"use client";

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: init.cache ?? "no-store",
  });
  if (response.status === 401) {
    window.dispatchEvent(new Event("admin-session-expired"));
  }
  return response;
}
