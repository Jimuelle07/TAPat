import { AGENT_META } from "./agentMeta.gen";

/** Static agent timing, sizes and still readouts. Written by figures/agents/build.ts from the figures' own models, and kept apart from
 *  AgentComposition so the page can read them without loading remotion or any drawing. */
export type AgentKind = "tranche" | "freeze";
export type AgentProps = { agent: AgentKind };

export { AGENT_META };
