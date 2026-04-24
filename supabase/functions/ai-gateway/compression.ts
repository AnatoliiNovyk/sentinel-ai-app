/**
 * Response compression utilities for efficient bandwidth usage.
 * Supports gzip compression for responses >2KB.
 */

/**
 * Compress data using gzip if available in runtime.
 * Falls back to uncompressed if gzip not supported.
 * @param data Raw data to compress
 * @returns Compressed data or original if compression unavailable
 */
export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  // Check if CompressionStream is available (modern runtimes)
  const RuntimeCompressionStream = (globalThis as unknown as {
    CompressionStream?: typeof CompressionStream;
  }).CompressionStream;

  if (!RuntimeCompressionStream) {
    // Fallback: return uncompressed
    return data;
  }

  try {
    const stream = new RuntimeCompressionStream('gzip');
    const writer = stream.writable.getWriter();
    writer.write(data);
    writer.close();

    const compressed: Uint8Array[] = [];
    const reader = stream.readable.getReader();

    let result = await reader.read();
    while (!result.done) {
      compressed.push(result.value);
      result = await reader.read();
    }

    // Concatenate all chunks
    const totalLength = compressed.reduce((sum, chunk) => sum + chunk.length, 0);
    const concatenated = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of compressed) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    return concatenated;
  } catch {
    // If compression fails, return uncompressed
    return data;
  }
}

/**
 * Determine if response should be compressed based on size and accepted encodings.
 */
export function shouldCompress(
  contentLength: number,
  acceptEncoding: string | null,
  minBytesForCompression = 2048,
): boolean {
  if (contentLength < minBytesForCompression) {
    return false;
  }

  if (!acceptEncoding) {
    return false;
  }

  // Check if client accepts gzip
  return acceptEncoding.toLowerCase().includes('gzip');
}
