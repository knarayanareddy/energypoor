import { getI18n } from "@/i18n/server";
import { ReviewBodyNl } from "./_nl";
import { ReviewBodyEn } from "./_en";
import { reviewFigures } from "./_figures";

export const dynamic = "force-dynamic";

/**
 * The review is long-form prose, so it is not in the flat UI dictionary: two
 * components, one per language, sharing one figures object. Dutch is served by
 * default; the English body is a mirror, not a replacement.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { locale } = await getI18n(await searchParams);
  const fig = reviewFigures();

  return (
    <main className="main narrow">
      <div className="prose">
        {locale === "en" ? <ReviewBodyEn fig={fig} /> : <ReviewBodyNl fig={fig} />}
      </div>
    </main>
  );
}
