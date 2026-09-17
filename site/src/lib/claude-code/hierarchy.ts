export interface InstructionScope {
  id: string;
  name: string;
  order: number;
  path: string;
}

export interface InstructionFragment {
  id: string;
  scopeId: string;
  text: string;
  conflictsWith: string | null;
  enforceable: boolean;
  enforcedBy: "settings" | "hook" | null;
}

export interface ComposedContribution {
  scope: InstructionScope;
  fragment: InstructionFragment;
}

export interface FragmentConflict {
  first: InstructionFragment;
  second: InstructionFragment;
}

export interface Composition {
  contributions: readonly ComposedContribution[];
  conflicts: readonly FragmentConflict[];
  unenforceable: readonly InstructionFragment[];
}

export type FragmentPlacement = Readonly<Record<string, string>>;

/**
 * Concatenate every prepared contribution in documented root-down order. A placement changes a
 * fragment's attributed scope only; it never removes, replaces, or resolves a contribution.
 */
export function compose(
  scopes: readonly InstructionScope[],
  fragments: readonly InstructionFragment[],
  placement: FragmentPlacement = {}
): Composition {
  const orderedScopes = [...scopes].sort((first, second) => first.order - second.order);
  const scopesById = new Map(orderedScopes.map((scope) => [scope.id, scope]));
  if (scopesById.size !== orderedScopes.length) {
    throw new Error("Instruction hierarchy contains a duplicate scope identifier.");
  }
  const assignedFragments = fragments.map((fragment) => {
    const requestedScope = placement[fragment.id];
    const scopeId = requestedScope ?? fragment.scopeId;
    if (!scopesById.has(scopeId)) {
      throw new Error(`Instruction fragment ${fragment.id} names unknown scope ${scopeId}.`);
    }
    return { fragment, scopeId };
  });
  const contributions = orderedScopes.flatMap((scope) =>
    assignedFragments
      .filter((assignment) => assignment.scopeId === scope.id)
      .map(({ fragment }) => ({ scope, fragment }))
  );
  if (contributions.length !== fragments.length) {
    throw new Error("Instruction composition dropped a contribution.");
  }

  return {
    contributions,
    conflicts: findConflicts(fragments),
    unenforceable: fragments.filter((fragment) => !fragment.enforceable)
  };
}

/** Report each conflicting pair once. Conflicts are observed, never resolved. */
export function findConflicts(fragments: readonly InstructionFragment[]): readonly FragmentConflict[] {
  const fragmentsById = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const seen = new Set<string>();
  const conflicts: FragmentConflict[] = [];
  for (const fragment of fragments) {
    if (fragment.conflictsWith === null) {
      continue;
    }
    const other = fragmentsById.get(fragment.conflictsWith);
    if (other === undefined) {
      continue;
    }
    const key = [fragment.id, other.id].sort().join("\u0000");
    if (!seen.has(key)) {
      seen.add(key);
      conflicts.push({ first: fragment, second: other });
    }
  }
  return conflicts;
}

/** Return the storage shape for a complete placement, including empty scopes. */
export function placementByScope(
  scopes: readonly InstructionScope[],
  fragments: readonly InstructionFragment[],
  placement: FragmentPlacement
): Record<string, string[]> {
  const result = Object.fromEntries(scopes.map((scope) => [scope.id, [] as string[]]));
  for (const fragment of fragments) {
    const scopeId = placement[fragment.id] ?? fragment.scopeId;
    if (!(scopeId in result)) {
      throw new Error(`Instruction fragment ${fragment.id} names unknown scope ${scopeId}.`);
    }
    result[scopeId].push(fragment.id);
  }
  return result;
}
