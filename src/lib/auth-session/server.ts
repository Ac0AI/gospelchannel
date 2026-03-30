import { headers } from "next/headers";
import { getAuthenticatedUserFromHeaders } from "@/lib/neon-client";

export async function createServerComponentClient() {
  return {
    auth: {
      async getUser() {
        const requestHeaders = await headers();
        const user = await getAuthenticatedUserFromHeaders(requestHeaders);
        return {
          data: { user },
        };
      },
    },
  };
}
