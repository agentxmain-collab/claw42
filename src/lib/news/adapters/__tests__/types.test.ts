import { describe, expect, it } from "vitest";
import { absoluteUrl, extractCurrenciesFromText } from "@/lib/news/adapters/types";

describe("extractCurrenciesFromText", () => {
  it("extracts explicit tickers, trading pairs, and common coin names", () => {
    expect(
      extractCurrenciesFromText(
        "Bitcoin ETF outflows pressure Ethereum while $SOL rebounds",
        "BTC/USDT volume rises",
        "Solana ecosystem update",
      ),
    ).toEqual(["BTC", "ETH", "SOL", "USDT"]);
  });

  it("does not turn ordinary uppercase news words into fake currencies", () => {
    expect(
      extractCurrenciesFromText(
        "SEC ETF approval debate continues as MARKET FLOWS accelerate",
        "CoinDesk",
      ),
    ).toEqual([]);
  });

  it("does not anchor broad crypto market headlines to BTC or market-maker stories", () => {
    expect(
      extractCurrenciesFromText("Crypto market rally accelerates as liquidity improves"),
    ).toEqual([]);
    expect(
      extractCurrenciesFromText("Crypto market maker raises capital for OTC expansion"),
    ).toEqual([]);
  });

  it("keeps unknown exchange tickers when they are explicitly uppercase", () => {
    expect(extractCurrenciesFromText("FIRO announces a network upgrade", "FIRO/USDT")).toEqual([
      "FIRO",
      "USDT",
    ]);
  });

  it("extracts common project names from general news headlines", () => {
    expect(
      extractCurrenciesFromText(
        "Sui and Aptos rally as Arbitrum governance vote lifts Optimism governance sentiment",
        "Ripple lawsuit update mentions Toncoin liquidity",
      ),
    ).toEqual(["SUI", "APT", "ARB", "OP", "XRP"]);
  });

  it("extracts emerging project names without turning generic uppercase words into symbols", () => {
    expect(
      extractCurrenciesFromText(
        "Bittensor subnet upgrade lifts sentiment while Hyperliquid volume sets a record",
        "Ethena and Morpho governance updates remain active",
        "PUMP and HYPE are generic uppercase words here",
      ),
    ).toEqual(["TAO", "HYPE", "ENA", "MORPHO"]);
  });
});

describe("absoluteUrl", () => {
  it("keeps absolute and relative http links", () => {
    expect(absoluteUrl("https://example.com/news", "https://fallback.example/feed")).toBe(
      "https://example.com/news",
    );
    expect(absoluteUrl("/markets/btc", "https://fallback.example/feed")).toBe(
      "https://fallback.example/markets/btc",
    );
  });

  it("rejects non-http article links", () => {
    expect(absoluteUrl("javascript:alert(1)", "https://fallback.example/feed")).toBeNull();
  });
});
