
const MASTER_KEY_PHRASE = "medibot-secure-vault-2025-prototype";

async function getEncryptionKey() {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(MASTER_KEY_PHRASE),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("medibot-salt-secure-unique"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(data: string): Promise<string> {
  if (!data) return "";
  try {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedData
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    // Use a custom b64 conversion to handle binary safely
    return btoa(Array.from(combined, (byte) => String.fromCharCode(byte)).join(""));
  } catch (e) {
    console.error("Encryption failed:", e);
    return data;
  }
}

export async function decryptData(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64 || encryptedBase64.length < 24) return encryptedBase64;
  try {
    const key = await getEncryptionKey();
    const binaryString = atob(encryptedBase64);
    const combined = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      combined[i] = binaryString.charCodeAt(i);
    }
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    // If decryption fails, it might be unencrypted legacy data
    return encryptedBase64;
  }
}
