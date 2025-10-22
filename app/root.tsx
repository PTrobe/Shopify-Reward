import type { LinksFunction, MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css";

export const meta: MetaFunction = () => {
  return [
    { title: "Loyco Rewards - Shopify Loyalty App" },
    { name: "description", content: "Powerful loyalty program for Shopify merchants" },
  ];
};

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: polarisStyles },
  ];
};

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}