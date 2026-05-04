function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function tripHashForRoom(roomId: string, trip: string): Promise<string> {
  const data = new TextEncoder().encode(`${roomId}:${trip}`);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}
