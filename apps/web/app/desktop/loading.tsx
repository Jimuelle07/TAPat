import { Skeleton } from "../(app)/_components/ui";

// Also the Suspense boundary that useParams and useSearchParams need under cacheComponents.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-10 py-8">
      <Skeleton kinds={["line", "row", "card", "card", "row"]} />
    </div>
  );
}
