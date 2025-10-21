import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Get shop information
  const response = await admin.rest.resources.Shop.all({ session });
  const shop = response.data[0];

  return json({
    shop: session.shop,
    shopInfo: shop,
  });
};

export default function App() {
  const { shop, shopInfo } = useLoaderData<typeof loader>();

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Loyco Rewards Dashboard</h1>
      <p>Welcome to your loyalty program dashboard for <strong>{shop}</strong></p>

      <div style={{ background: "#f5f5f5", padding: "15px", borderRadius: "8px", marginTop: "20px" }}>
        <h2>Quick Setup</h2>
        <p>Get started with your loyalty program in just a few minutes:</p>
        <ol>
          <li>Configure your points system</li>
          <li>Set up rewards</li>
          <li>Customize your widget</li>
          <li>Launch your program</li>
        </ol>
      </div>

      <div style={{ marginTop: "30px" }}>
        <h3>Shop Information</h3>
        <pre style={{ background: "#f8f8f8", padding: "10px", borderRadius: "4px" }}>
          {JSON.stringify(shopInfo, null, 2)}
        </pre>
      </div>
    </div>
  );
}