import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);

    return json({
      shop: session.shop,
      authenticated: true,
    });
  } catch (error) {
    // If authentication fails, let the auth system handle it
    console.error("Authentication error:", error);
    throw error;
  }
};

export default function App() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <div style={{
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      background: "#f6f6f7"
    }}>
      <header style={{
        background: "white",
        padding: "16px 24px",
        borderBottom: "1px solid #e1e3e5",
        marginBottom: "24px"
      }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 600 }}>
          Loyco Rewards - {shop}
        </h1>
      </header>

      <main style={{ padding: "0 24px" }}>
        <Outlet />
      </main>
    </div>
  );
}