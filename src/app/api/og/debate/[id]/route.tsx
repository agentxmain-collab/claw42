import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = { width: 1200, height: 630 };

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const debateId = decodeURIComponent(params.id);
  const title =
    debateId === "latest"
      ? "3 Agents are debating the latest crypto market signal"
      : `Claw 42 debate ${debateId.replace(/^debate:/, "").slice(0, 64)}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #050508 0%, #15102f 52%, #060608 100%)",
          color: "white",
          padding: 64,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              height: 56,
              width: 56,
              borderRadius: 18,
              background: "linear-gradient(135deg, #7c5cff, #ff5bb7)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 800 }}>Claw 42 Agent Debate</div>
        </div>
        <div>
          <div style={{ marginBottom: 20, color: "#b8a9ff", fontSize: 26, fontWeight: 700 }}>
            $BTC / $ETH / $SOL
          </div>
          <div style={{ maxWidth: 940, fontSize: 58, fontWeight: 900, lineHeight: 1.08 }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: "#b7b7c7", fontSize: 26 }}>
            AI-generated market debate · Not investment advice
          </div>
          <div style={{ color: "#8f7bff", fontSize: 28, fontWeight: 800 }}>claw42.ai</div>
        </div>
      </div>
    ),
    size,
  );
}
