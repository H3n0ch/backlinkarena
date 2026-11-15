import type { Metadata } from "next";
import { Suspense } from "react";
import { ArenaSkeleton } from "@/components/ArenaSkeleton";
import { matchMetadata, MatchScreen } from "@/app/match/[id]/screen";
import { getMatchIdByPair } from "@/lib/data";

/** Readable matchup URL: /vs/brand-a-vs-brand-b */
export async function generateMetadata({ params }: PageProps<"/vs/[pair]">): Promise<Metadata> {
  const { pair } = await params;
  return matchMetadata(await getMatchIdByPair(pair));
}

export default function VsPage({ params, searchParams }: PageProps<"/vs/[pair]">) {
  return (
    <Suspense fallback={<ArenaSkeleton />}>
      <ByPair params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ByPair({
  params,
  searchParams,
}: {
  params: Promise<{ pair: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { pair } = await params;
  return <MatchScreen id={await getMatchIdByPair(pair)} searchParams={searchParams} />;
}
