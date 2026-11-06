"use client";

import { useDashboard } from "@/lib/use-dashboard";
import { StationRow } from "../../(app)/_components/money";
import { DemoRate, EmptyState } from "../../(app)/_components/ui";
import { Gate, Page } from "../_components/kit";

export default function Stations() {
  const state = useDashboard();
  return (
    <Page title="Stations">
      <Gate state={state} what="stations" empty="Stations appear once a program is running." icon="pump">
        {(dashboard) =>
          dashboard.stations.length === 0 ? (
            // POST /api/program does not create stations; only the demo seed does.
            <EmptyState icon="pump" title="No stations yet" body="Stations are created by seed-demo.ts." />
          ) : (
            <>
              <div className="grid grid-cols-2 items-start gap-4">
                {dashboard.stations.map((station) => (
                  <StationRow key={station.id} station={station} phpPerXlm={dashboard.phpPerXlm} href={`/desktop/stations/${station.id}`} />
                ))}
              </div>
              <DemoRate />
            </>
          )
        }
      </Gate>
    </Page>
  );
}
