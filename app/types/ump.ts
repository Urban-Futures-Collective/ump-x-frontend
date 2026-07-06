// Domänenmodell. Komponenten konsumieren nur dieses, nie rohes OGC-JSON.
export interface Process {
  id: string
  title: string
  description: string
  version: string
  keywords: string[]
}
