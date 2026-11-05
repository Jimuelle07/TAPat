import { formatPhp } from "@tapat/shared";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">TAPat</h1>
      <p className="text-zinc-600">
        Funded {formatPhp(0n)} <span className="text-xs">(demo rate)</span>
      </p>
    </main>
  );
}
