import axe, { type AxeResults, type RunOptions } from "axe-core";

function formatViolations(violations: AxeResults["violations"]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `  - ${n.target.join(" ")}: ${n.html}`)
        .join("\n");
      return `${v.id} (${v.impact}): ${v.help}\n${nodes}`;
    })
    .join("\n\n");
}

function isFocusGuardNode(
  node: AxeResults["violations"][number]["nodes"][number]
): boolean {
  return node.html.includes("data-base-ui-focus-guard");
}

export async function expectNoViolations(
  container: HTMLElement,
  options?: RunOptions
): Promise<void> {
  const results = await axe.run(container, options ?? {});
  const violations = results.violations.filter(
    (v) => !v.nodes.every(isFocusGuardNode)
  );
  if (violations.length > 0) {
    throw new Error(`Accesibilidad:\n${formatViolations(violations)}`);
  }
}
