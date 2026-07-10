/**
 * Cryptographic utility functions for secure end-to-end encryption (E2EE)
 * using the Web Crypto API (AES-GCM-256).
 */

// Helper to convert ArrayBuffer to Hex string
export function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper to convert Hex string to Uint8Array
export function hexToBuf(hex: string): Uint8Array {
  const match = hex.match(/.{1,2}/g);
  if (!match) throw new Error("Invalid hex string");
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
}

// Helper to convert ArrayBuffer to Base64 string
export function bufToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 string to Uint8Array
export function base64ToBuf(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates a random cryptographically secure AES-GCM 256-bit key.
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a CryptoKey object to a raw Hex string for URL sharing.
 */
export async function exportKeyToHex(key: CryptoKey): Promise<string> {
  const raw = await window.crypto.subtle.exportKey("raw", key);
  return bufToHex(raw);
}

/**
 * Imports a raw Hex string back into a CryptoKey object.
 */
export async function importKeyFromHex(hexKey: string): Promise<CryptoKey> {
  const bytes = hexToBuf(hexKey);
  return await window.crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts data (ArrayBuffer or Uint8Array) using AES-GCM and a specified CryptoKey.
 * Returns the encrypted ArrayBuffer and the generated random IV.
 */
export async function encryptData(
  data: ArrayBuffer | Uint8Array,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  // Generate random 12-byte initialization vector (IV) for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    data
  );
  return { encrypted, iv };
}

/**
 * Decrypts data using AES-GCM, the specified CryptoKey, and the IV.
 * Returns the decrypted ArrayBuffer.
 */
export async function decryptData(
  encryptedData: ArrayBuffer | Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encryptedData
  );
}

/**
 * Encrypts a string value.
 */
export async function encryptText(
  text: string,
  key: CryptoKey
): Promise<{ encryptedBase64: string; ivHex: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const { encrypted, iv } = await encryptData(data, key);
  return {
    encryptedBase64: bufToBase64(encrypted),
    ivHex: bufToHex(iv),
  };
}

/**
 * Decrypts a string value from Base64 and IvHex.
 */
export async function decryptText(
  encryptedBase64: string,
  key: CryptoKey,
  ivHex: string
): Promise<string> {
  const encryptedBytes = base64ToBuf(encryptedBase64);
  const ivBytes = hexToBuf(ivHex);
  const decryptedBuffer = await decryptData(encryptedBytes, key, ivBytes);
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
