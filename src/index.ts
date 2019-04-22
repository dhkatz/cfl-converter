import { BinaryReader, BinaryWriter, Encoding } from 'csharp-binary-stream';
import { buffer as toBuffer } from 'get-stream';

import JSZip from 'jszip';
import lzma from 'lzma-purejs';

/*
  Extra interfaces have been defined in case I decide to expand this package.
  I had plans to create a web interface to mimic the CFL Viewer that Toyz made,
  but I don't really see the point in wasting the effort when Toyz' program exists.
*/

export interface CFLEntry {
  compression: number;
  offset: number;
  length: number;
  size: number;

  name: string;
  hash: string | null;

  contents: ArrayBufferLike;
}

export interface CFLOptions {
  log?: boolean;
}

/**
 * Convert a CFL file buffer to a ZIP file buffer.
 * @param buffer An `ArrayBufferLike` structure created from a CFL file.
 * @param debug If debug information should be logged or not.
 */
export async function convert(buffer: ArrayBufferLike, options?: CFLOptions): Promise<ArrayBufferLike> {
  const reader = new BinaryReader(buffer);

  // CFL Header
  // This information is exclusive to the CFL format

  const hashed = reader.readChars(4, Encoding.Utf8) === 'DFL3';

  reader.position = reader.readUnsignedInt();

  const format = reader.readInt();

  if (options.log) {
    console.log('Decoded CFL header.');
  }

  // Decompress the LZMA section of the CFL file
  const content = Uint8Array.from(reader.readBytes(reader.readInt()));
  const data = new BinaryReader(format === 4 ? decompress(content) : content);

  if (options.log) {
    console.log('Decompressed CFL content.');
  }

  // Parse the CFL entries
  const entries: CFLEntry[] = [];

  let position = 0;
  while (data.length > position) {
    // CFL entry header data
    const size = data.readInt();
    const offset = data.readInt();
    const compression = data.readInt();
    const name = data.readChars(data.readShort(), Encoding.Utf8);

    reader.position = offset;

    // Decompress the LZMA section of the entry
    const entry = Uint8Array.from(reader.readBytes(reader.readUnsignedInt()));
    const contents = compression === 4 ? decompress(entry) : entry;

    // Calculate hash and entry size
    const hash: string | null = hashed ? data.readChars(data.readInt(), Encoding.Utf8) : null;
    const length = 14 + name.length + (hash !== null && hash.match(/^\s*$/) === null ? 4 + hash.length : 0);

    entries.push({
      compression,
      contents,
      hash,
      length,
      name,
      offset,
      size,
    });

    position += length;
  }

  if (options.log) {
    console.log(`Parsed ${entries.length} CFL ${entries.length !== 1 ? 'entries' : 'entry'}.`);
  }

  const zip = new JSZip();

  entries.forEach((entry: CFLEntry) => {
    zip.file(entry.name, entry.contents);
  });

  return toBuffer(zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }));
}

/**
 * Decompress an LZMA buffer.
 * @param data LZMA compressed data.
 */
export function decompress(data: ArrayBufferLike): ArrayBufferLike {
  const reader = new BinaryReader(data);
  const writer = new BinaryWriter();
  // Read the first 5 bytes, they are the properties
  // Set size to -1 to just read to EOS
  lzma.decompress(reader.readBytes(5), reader, writer, -1);
  return writer.toUint8Array();
}
