import { Body, Skeleton, TopBar } from "./_components/ui";

// Also the Suspense boundary that useParams and useSearchParams need under cacheComponents.
export default function Loading() {
  return (
    <>
      <TopBar />
      <Body>
        <Skeleton kinds={["line", "row", "card", "card", "row"]} />
      </Body>
    </>
  );
}
