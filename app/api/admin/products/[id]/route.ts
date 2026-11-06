import { ADMIN_PRIVATE_HEADERS, getAdminAuthFailure } from "@/lib/server/admin-auth";
import { DELETE as deleteHandler } from "../route";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authFailure = getAdminAuthFailure(request);
  if (authFailure) {
    return new Response(JSON.stringify({ error: authFailure.message }), {
      status: authFailure.status,
      headers: { "Content-Type": "application/json", ...ADMIN_PRIVATE_HEADERS },
    });
  }

  const { id } = await params;
  const url = new URL(request.url);
  url.searchParams.set("id", id);
  const forwardedRequest = new Request(url.toString(), {
    method: "DELETE",
    headers: request.headers,
  });

  return deleteHandler(forwardedRequest);
}

