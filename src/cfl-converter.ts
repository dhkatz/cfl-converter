#!/usr/bin/env node
import program from 'commander';
import fs from 'fs';
import JSZip from 'jszip';
import lzma from 'lzma-purejs';

import { BinaryReader, BinaryWriter, Encoding  } from 'csharp-binary-stream';

interface CFLEntry {
  compression: number;
  offset: number;
  length: number;
  size: number;

  name: string;
  hash: string | null;

  contents: Uint8Array;
}

async function main() {
  program
  .version('0.0.1')
  .option('-I, --input <files>', '.CFL file(s) to convert.', (value: string): string[] => value.split(','))
  .parse(process.argv);

  const inputs: string[] = program.input;

  for (const input of inputs) {
    if (!input.toLocaleLowerCase().endsWith('.cfl')) {
      console.error('This program only supports files ending with the .CFL extension!');
      return;
    }

    const reader = new BinaryReader(fs.readFileSync(input));

    // CFL Header
    // This information is exclusive to the CFL format

    const hashed = reader.readChars(4, Encoding.Utf8) === 'DFL3';

    reader.position = reader.readUnsignedInt();

    const format = reader.readInt();

    // Decompress the LZMA section of the CFL file
    const content = Uint8Array.from([...Array(reader.readInt())].map(() => reader.readByte()));
    const data = new BinaryReader(format === 4 ? decompress(content) : content);

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
      const entry = Uint8Array.from([...Array(reader.readUnsignedInt())].map(() => reader.readByte()));
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

    const zip = new JSZip();

    entries.forEach((entry: CFLEntry) => {
      zip.file(entry.name, entry.contents);
    });

    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(fs.createWriteStream(`${input.slice(0, -4)}.chkn`))
      .on('close', () => console.log(`Wrote to ${input.slice(0, -4)}.chkn`));
  }
}

function decompress(data: Uint8Array | Buffer): Uint8Array {
  const reader = new BinaryReader(data);
  const writer = new BinaryWriter();
  // Read the first 5 bytes, they are the properties
  // Set size to -1 to just read to EOS
  lzma.decompress([...Array(5)].map(() => reader.readByte()), reader, writer, -1);
  return writer.toUint8Array();
}

main();
