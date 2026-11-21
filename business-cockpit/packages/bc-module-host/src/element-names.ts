import { elementPrefix } from '@example/bc-module-kit';

/** Names the HTML standard does not allow for a custom element, although they have a hyphen. */
const RESERVED_ELEMENT_NAMES = new Set([
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-src',
  'font-face-uri',
  'font-face-format',
  'font-face-name',
  'missing-glyph',
]);

/** The characters the HTML standard allows in the name of a custom element after its first letter. */
const ELEMENT_NAME_CHAR =
  '[-.0-9_a-z\\u00B7\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u203F-\\u2040\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}]';
const VALID_ELEMENT_NAME = new RegExp(`^[a-z]${ELEMENT_NAME_CHAR}*-${ELEMENT_NAME_CHAR}*$`, 'u');

/** Whether the HTML standard allows `name` as the name of a custom element. */
export function isValidElementName(name: unknown): name is string {
  return typeof name === 'string' && VALID_ELEMENT_NAME.test(name) && !RESERVED_ELEMENT_NAMES.has(name);
}

/**
 * Says why a module may not draw a web component with this name, or nothing when it may. A name is
 * refused when it is no valid name of a custom element, when it does not start with the prefix of its
 * module and a hyphen, or when it starts with the longer prefix of another module of the registry: a
 * module `taxi` may not name `taxi-ride-confirm` when there is a module `taxi-ride`. The check does not
 * look for the build id, so a name without it passes.
 */
export function problemOfElementName(name: unknown, moduleId: string, otherModuleIds: string[]): string | undefined {
  const prefix = elementPrefix(moduleId);
  if (!isValidElementName(name)) return 'is no valid name of a custom element';
  if (!name.startsWith(`${prefix}-`)) return `does not start with the prefix ${prefix} of the module and a hyphen`;
  const longerPrefixOfOther = otherModuleIds
    .map((id) => ({ id, prefix: elementPrefix(id) }))
    .filter((other) => other.prefix.length > prefix.length)
    .find((other) => name.startsWith(`${other.prefix}-`));
  if (longerPrefixOfOther) return `starts with the prefix ${longerPrefixOfOther.prefix} of the module ${longerPrefixOfOther.id}`;
  return undefined;
}
