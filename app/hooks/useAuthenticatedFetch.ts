import { useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticatedFetch } from "@shopify/app-bridge-utils";

export function useAuthenticatedFetch() {
  const app = useAppBridge();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!app) {
        return fetch(input, init);
      }

      const fetchFunction = authenticatedFetch(app);
      const response = await fetchFunction(input, init);

      if (response.headers.get("X-Shopify-API-Request-Failure-Reauthorize") === "1") {
        const authUrl = response.headers.get("X-Shopify-API-Request-Failure-Reauthorize-Url");
        if (authUrl) {
          window.location.assign(authUrl);
        }
      }

      return response;
    },
    [app],
  );
}
