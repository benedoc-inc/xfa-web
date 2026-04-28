// Converts an XFA field name into a human-readable label when no caption is present.
// "IUCheckBox111" → "IU Check Box", "TypeOfUse" → "Type Of Use"
export function formatFieldName(name: string): string {
  const base = name.replace(/\d+$/, '').trim()
  if (!base) return name
  return base
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}
