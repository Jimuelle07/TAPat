"use client";

import { useId, useState } from "react";
import { AGENT_META, type AgentKind } from "./remotion/agentMeta";
import { RemotionStage } from "./remotion/Stage";
import "./iso/iso.css";
import "./agents.css";

type Ref = { href: string; label: string };

type AgentCard = {
  name: string;
  job: string;
  method: string;
  refs: Ref[];
  citeOnly?: string;
  settings: string;
  kind: AgentKind;
  fig: string;
  hint: string;
  label: string;
};

const AGENTS: AgentCard[] = [
  {
    name: "Tranche Agent",
    job: "Releases each card’s fuel aid when diesel has really moved.",
    method: "Bayesian Online Changepoint Detection.",
    refs: [
      {
        href: "https://arxiv.org/abs/0710.3742",
        label: "Adams & MacKay (2007), arXiv:0710.3742",
      },
    ],
    settings:
      "Hazard 1/50. Fires when the changepoint probability is at least 0.9, the new level has held at least 4 days, and its mean is at least ₱65.00/L.",
    kind: "tranche",
    fig: "Fig 6",
    hint: "Simulated · hover or tap",
    label:
      "Illustration of the Tranche Agent as a bench instrument replaying a simulated diesel price series. A cursor climbs a price scale past the 65 peso mark, a carriage on a rail slides to the changepoint probability, and four plungers rise one by one as the new level holds. When the probability, the held days and the level all pass their tests, three keys lift, a gate bar rises, and three 1,500 peso tokens slide down their lanes onto three cards. Then everything resets.",
  },
  {
    name: "Freeze Agent",
    job: "Pauses a station whose taps look wrong.",
    method: "MIDAS-F edge-stream anomaly detection on Count-Min Sketches.",
    refs: [
      {
        href: "https://arxiv.org/abs/1911.04464",
        label:
          "Bhatia et al., “MIDAS: Microcluster-Based Detector of Anomalies in Edge Streams”, AAAI 2020",
      },
      {
        href: "https://arxiv.org/abs/2009.08452",
        label:
          "MIDAS-F: Bhatia et al., “Real-Time Anomaly Detection in Edge Streams”, ACM TKDD 2022",
      },
    ],
    citeOnly: "Count-Min Sketch: Cormode & Muthukrishnan (2005), Journal of Algorithms.",
    settings:
      "A 2×1024 sketch with decay 0.6, plus two LGU rules: a near-cap streak and a volume spike.",
    kind: "freeze",
    fig: "Fig 7",
    hint: "Simulated taps · hover or tap",
    label:
      "Illustration of the Freeze Agent as a bench rig replaying simulated taps. Tap tokens ride a lane past a sensor arch to a fuel station's reader, and each one raises columns in a two-row Count-Min Sketch that fall back by 0.6 each tick. A dial needle follows the MIDAS-F score toward the freeze line. When a burst of near-cap taps carries it over, a lamp lights and a shutter drops over the station. Then everything resets.",
  },
];

function AgentCardView({ agent }: { agent: AgentCard }): React.JSX.Element {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const titleId = `${uid}-title`;
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hovered || focused;
  const meta = AGENT_META[agent.kind];

  return (
    <div
      data-open={open}
      data-theme="light"
      className="agent-card iso relative grid overflow-hidden rounded-[2px] border border-text bg-raised"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHovered(false);
      }}
      onFocus={(e) => {
        if (e.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setPinned((p) => !p)}
        className="col-start-1 row-start-1 flex flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-accent"
      >
        <span className="iso-plate ag-plate block">
          <span className="iso-plate-corners" aria-hidden="true">
            <span className="iso-plate-corner" data-corner="fig">
              {agent.fig}
            </span>
            <span className="iso-plate-corner" data-corner="title">
              {agent.name}
            </span>
            <span className="iso-plate-corner" data-corner="hint">
              {agent.hint}
            </span>
            <span className="iso-plate-corner" data-corner="readout" data-readout="">
              {meta.readout}
            </span>
          </span>
          <span className="ag-art block">
            <RemotionStage
              inputProps={{ agent: agent.kind }}
              durationInFrames={meta.duration}
              fps={meta.fps}
              compositionWidth={meta.width}
              compositionHeight={meta.height}
              stillFrame={meta.still}
              paused={open}
              label={agent.label}
              className="ag-stage block w-full"
            />
          </span>
        </span>
        <span className="flex flex-col gap-1 border-t border-text px-5 py-4">
          <span id={titleId} className="doc-h3">
            {agent.name}
          </span>
          <span className="doc-small text-muted">{agent.job}</span>
        </span>
      </button>

      <div className="agent-panel-wrap pointer-events-none col-start-1 row-start-1">
        <div
          id={panelId}
          role="region"
          aria-labelledby={titleId}
          inert={!open}
          className={`h-full border-t border-text bg-raised px-5 py-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
            open ? "pointer-events-auto translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <dl className="doc-small flex flex-col gap-3">
            <div>
              <dt className="doc-mono text-muted">Method</dt>
              <dd>{agent.method}</dd>
            </div>
            <div>
              <dt className="doc-mono text-muted">Research</dt>
              <dd className="flex flex-col gap-1">
                {agent.refs.map((r) => (
                  <a
                    key={r.href}
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-link"
                  >
                    {r.label}
                  </a>
                ))}
                {agent.citeOnly ? <span>{agent.citeOnly}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="doc-mono text-muted">Settings</dt>
              <dd>{agent.settings}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

export function Agents(): React.JSX.Element {
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        {AGENTS.map((a) => (
          <AgentCardView key={a.name} agent={a} />
        ))}
      </div>
      <p className="doc-small mt-4 text-center text-muted">
        Hover or tap an agent to see how it decides.
      </p>
    </div>
  );
}
