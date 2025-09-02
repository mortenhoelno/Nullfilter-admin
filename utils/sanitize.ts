export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // fjern aksenter
    .replace(/\s+/g, "_")                              // mellomrom → _
    .replace(/[^a-zA-Z0-9._-]/g, "");                 // fjern alt annet
}
