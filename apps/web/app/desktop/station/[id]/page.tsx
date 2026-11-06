"use client";

import { useParams } from "next/navigation";
import { dateTime, php } from "@/lib/format";
import { useDashboard } from "@/lib/use-dashboard";
import Terminal from "@/app/(app)/station/[id]/page";
import { StationRow } from "@/app/(app)/_components/money";
import { Card, KeyValues } from "@/app/(app)/_components/ui";
import { Embedded } from "../../_components/kit";

/** What the contract checks on every tap, beside the terminal that sends it. */
function Rules({ id }: { id: string }) {
  const state = useDashboard();
  if (state.status !== "ready") return null;
  const { program, phpPerXlm, stations } = state.dashboard;
  const station = stations.find((s) => s.id === id);
  return (
    <>
      {station !== undefined ? <StationRow station={station} phpPerXlm={phpPerXlm} href={`/desktop/stations/${id}`} /> : null}
      <Card>
        <h2 className="text-label">Checked on every tap</h2>
        <KeyValues
          rows={[
            ["Per-tap cap", php(program.perTapCapStroops, phpPerXlm)],
            ["Policy expires", dateTime(program.expiresAtS * 1000)],
          ]}
        />
        <p className="text-caption">The contract decides. A rejected tap submits no transaction.</p>
      </Card>
      <Card>
        <h2 className="text-label">On this computer</h2>
        <p className="text-small">Read card needs Chrome on an Android phone. Simulate tap picks the card from a list; the payment is still a real authorize on-chain.</p>
      </Card>
    </>
  );
}

export default function DesktopStation() {
  const { id } = useParams<{ id: string }>();
  return (
    <Embedded title="Station terminal" side={<Rules id={id} />}>
      <Terminal />
    </Embedded>
  );
}
