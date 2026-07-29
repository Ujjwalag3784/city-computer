/**
 * Connector satisfaction — docs/08-PC-BUILDER-ENGINE.md §4.3: "a single
 * generic check, not one rule per connector type." For every
 * `ConnectorType` that appears anywhere in the build's selected parts'
 * `PartConnector` rows, sum `REQUIRES` quantity against `PROVIDES`
 * quantity across every selected part, once. The result feeds both
 * `rule-expression.ts`'s `CONNECTOR_SATISFIED` operator and the engine's
 * own direct connector-shortfall issue emission (`validate-build.ts`),
 * so this is the only place the REQUIRES/PROVIDES arithmetic happens.
 *
 * Adapter downgrades (§4.3's own carve-out — e.g. a 12VHPWR GPU with a
 * bundled 8-pin-to-12VHPWR adapter shouldn't hard-fail against a PSU that
 * only provides 8-pin PCIe): modeled as a fixed table of
 * `{ shortfallType, coveredBy }` pairs. If a connector type has a
 * shortfall but every unit of that shortfall could be covered by a
 * surplus in an adapter-compatible type, the result is downgraded from
 * "unsatisfied" to "satisfied with adapter" rather than a hard failure —
 * still surfaced (via `satisfiedWithAdapter`) so the UI can say so, but
 * it does not block.
 */
import "server-only";
import type { SelectedPart } from "./build-context";

export interface ConnectorBalanceEntry {
  required: number;
  provided: number;
  satisfied: boolean;
  satisfiedWithAdapter: boolean;
  shortfall: number;
}

export type ConnectorBalanceMap = Record<string, ConnectorBalanceEntry>;

/** `{ shortfallConnectorType: [coveringConnectorType, ...] }` — a shortfall in the key type can be covered by surplus PROVIDES in any of the listed types, via a bundled adapter. Keys/values are real `ConnectorType` enum members (schema.prisma), e.g. a 12VHPWR-only GPU whose PSU only provides 8-pin PCIe still works via the adapter almost every such GPU ships with. */
const ADAPTER_COVERAGE: Record<string, string[]> = {
  PCIE_12VHPWR: ["PCIE_8PIN", "PCIE_6PIN"],
  PCIE_12V2X6: ["PCIE_8PIN", "PCIE_6PIN"],
  PCIE_8PIN: ["PCIE_6PIN"],
};

/** Runs the §4.3 pass over a build's selected parts (each with its own `connectors` rows already loaded). */
export function computeConnectorBalance(parts: SelectedPart[]): ConnectorBalanceMap {
  const totals = new Map<string, { required: number; provided: number }>();

  for (const { part, quantity } of parts) {
    for (const connector of part.connectors) {
      const key = connector.connectorType as string;
      const entry = totals.get(key) ?? { required: 0, provided: 0 };
      const contributed = connector.quantity * quantity;
      if (connector.direction === "REQUIRES") entry.required += contributed;
      else entry.provided += contributed;
      totals.set(key, entry);
    }
  }

  const balance: ConnectorBalanceMap = {};
  for (const [connectorType, { required, provided }] of totals) {
    const shortfall = Math.max(0, required - provided);
    let satisfiedWithAdapter = false;

    if (shortfall > 0) {
      // eslint-disable-next-line security/detect-object-injection -- `connectorType` comes from iterating this function's own `totals` map keys (built from `ConnectorType` enum values on `PartConnector` rows), never arbitrary input.
      const coveringTypes = ADAPTER_COVERAGE[connectorType] ?? [];
      let remainingShortfall = shortfall;
      for (const coveringType of coveringTypes) {
        const covering = totals.get(coveringType);
        if (!covering) continue;
        const surplus = Math.max(0, covering.provided - covering.required);
        remainingShortfall = Math.max(0, remainingShortfall - surplus);
      }
      satisfiedWithAdapter = remainingShortfall === 0;
    }

    // eslint-disable-next-line security/detect-object-injection -- same closed-set key as above.
    balance[connectorType] = {
      required,
      provided,
      satisfied: shortfall === 0,
      satisfiedWithAdapter,
      shortfall,
    };
  }

  return balance;
}
