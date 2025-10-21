import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { prisma } from "../lib/prisma.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
    include: {
      loyaltyProgram: {
        include: {
          tiers: {
            orderBy: { level: 'asc' }
          },
          rewards: {
            where: { active: true },
            orderBy: { displayOrder: 'asc' }
          }
        }
      }
    },
  });

  if (!shop) {
    throw new Response("Shop not found", { status: 404 });
  }

  // Quick stats
  const [customerCount, totalPoints, totalRedemptions] = await Promise.all([
    prisma.customer.count({ where: { shopId: shop.id } }),
    prisma.transaction.aggregate({
      where: { shopId: shop.id, type: "EARNED" },
      _sum: { points: true }
    }),
    prisma.redemption.count({
      where: { customer: { shopId: shop.id } }
    })
  ]);

  return json({
    shop,
    stats: {
      customerCount,
      totalPoints: totalPoints._sum.points || 0,
      totalRedemptions
    }
  });
};

export default function Dashboard() {
  const { shop, stats } = useLoaderData<typeof loader>();

  return (
    <div style={{
      padding: "24px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: "#f6f6f7",
      minHeight: "100vh"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "12px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h1 style={{ margin: 0, fontSize: "28px", color: "#202123" }}>
            Loyco Rewards Dashboard
          </h1>
          <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
            Managing loyalty program for <strong>{shop.shopifyDomain}</strong>
          </p>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "32px"
        }}>
          <StatCard
            title="Total Customers"
            value={stats.customerCount.toLocaleString()}
            color="#10b981"
          />
          <StatCard
            title="Points Issued"
            value={stats.totalPoints.toLocaleString()}
            color="#3b82f6"
          />
          <StatCard
            title="Total Redemptions"
            value={stats.totalRedemptions.toLocaleString()}
            color="#8b5cf6"
          />
        </div>

        {/* Program Status */}
        <div style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "12px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "20px", color: "#202123" }}>
            Program Status
          </h2>

          {shop.loyaltyProgram ? (
            <div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "8px 16px",
                backgroundColor: shop.loyaltyProgram.active ? "#d1fae5" : "#fef3c7",
                borderRadius: "20px",
                marginBottom: "16px"
              }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: shop.loyaltyProgram.active ? "#10b981" : "#f59e0b",
                  marginRight: "8px"
                }}></div>
                <span style={{
                  color: shop.loyaltyProgram.active ? "#065f46" : "#92400e",
                  fontWeight: "500"
                }}>
                  {shop.loyaltyProgram.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div>
                  <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#374151" }}>
                    Program Details
                  </h3>
                  <div style={{ color: "#6b7280", lineHeight: "1.6" }}>
                    <p><strong>Name:</strong> {shop.loyaltyProgram.name}</p>
                    <p><strong>Points Name:</strong> {shop.loyaltyProgram.pointsName}</p>
                    <p><strong>Points per $:</strong> {shop.loyaltyProgram.pointsPerDollar}</p>
                    <p><strong>Welcome Bonus:</strong> {shop.loyaltyProgram.welcomeBonus} points</p>
                  </div>
                </div>

                <div>
                  <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#374151" }}>
                    Features
                  </h3>
                  <div style={{ color: "#6b7280", lineHeight: "1.6" }}>
                    <p>🎯 Tiers: {shop.loyaltyProgram.tiersEnabled ?
                      `Enabled (${shop.loyaltyProgram.tiers.length} tiers)` : "Disabled"}</p>
                    <p>👥 Referrals: {shop.loyaltyProgram.referralsEnabled ? "Enabled" : "Disabled"}</p>
                    <p>⏰ Point Expiration: {shop.loyaltyProgram.expirationEnabled ?
                      `${shop.loyaltyProgram.expirationDays} days` : "Disabled"}</p>
                    <p>🎁 Active Rewards: {shop.loyaltyProgram.rewards.length}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: "center",
              padding: "40px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              border: "2px dashed #d1d5db"
            }}>
              <h3 style={{ margin: "0 0 8px", color: "#374151" }}>
                No Loyalty Program Configured
              </h3>
              <p style={{ margin: "0 0 16px", color: "#6b7280" }}>
                Set up your loyalty program to start rewarding customers
              </p>
              <button style={{
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "500"
              }}>
                Create Program
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "20px", color: "#202123" }}>
            Quick Actions
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px"
          }}>
            <ActionButton href="/app/customers" title="Manage Customers" />
            <ActionButton href="/app/rewards" title="Manage Rewards" />
            <ActionButton href="/app/settings" title="Program Settings" />
            <ActionButton href="/app/analytics" title="View Analytics" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div style={{
      backgroundColor: "white",
      padding: "24px",
      borderRadius: "12px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
    }}>
      <h3 style={{
        margin: "0 0 8px",
        fontSize: "14px",
        fontWeight: "500",
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.05em"
      }}>
        {title}
      </h3>
      <div style={{
        fontSize: "28px",
        fontWeight: "700",
        color,
        margin: "0"
      }}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({ href, title }: { href: string; title: string }) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        padding: "16px",
        backgroundColor: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        textDecoration: "none",
        color: "#374151",
        fontWeight: "500",
        textAlign: "center",
        transition: "all 0.2s",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#f3f4f6";
        e.currentTarget.style.borderColor = "#d1d5db";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "#f9fafb";
        e.currentTarget.style.borderColor = "#e5e7eb";
      }}
    >
      {title}
    </a>
  );
}