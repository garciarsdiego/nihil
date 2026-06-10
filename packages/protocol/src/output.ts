import { escapeXml } from "./escape.js";
import type { NihilOutput } from "./types.js";

/**
 * Serialize an execution result into a <nihil-output> element for injection
 * into the next model turn. Never emitted by the model; the parser strips
 * model-emitted instances.
 */
export function serializeOutput(o: NihilOutput): string {
  const attrs: string[] = [`type="${o.type}"`];
  if (o.code) attrs.push(`code="${o.code}"`);
  if (o.action !== undefined) attrs.push(`action="${o.action}"`);
  if (o.path) attrs.push(`path="${escapeXml(o.path)}"`);
  attrs.push(`message="${escapeXml(o.message)}"`);
  const body = o.body ? escapeXml(o.body) : "";
  return `<nihil-output ${attrs.join(" ")}>${body}</nihil-output>`;
}
