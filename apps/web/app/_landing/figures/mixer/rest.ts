import { describeOf, readoutOf, simulateDieselYear, stateAt } from "./model";

/* The machine at rest: week one of simulated year one. The server draws it; the client starts its loop from the same year. */
export const YEAR_ONE = simulateDieselYear(1);
export const REST_STATE = stateAt(YEAR_ONE, 0);
export const REST_READOUT = readoutOf(REST_STATE, 1);
export const REST_TEXT = describeOf(REST_STATE, 1);
