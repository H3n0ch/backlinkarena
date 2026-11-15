import { getMatchIdByPair } from "@/lib/data";
import { renderMatchImage } from "@/lib/og";

export const alt = "A 1v1 matchup on Backlink Arena";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  return renderMatchImage((await getMatchIdByPair(pair)) ?? "");
}
