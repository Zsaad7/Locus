export async function getPublicIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json()
    return data.ip ?? null
  } catch (e) {
    return null
  }
}

export function isAtStation(clientIp: string | null, allowedIp: string | null): boolean {
  if (!allowedIp) return false
  if (!clientIp) return false
  return clientIp === allowedIp
}
