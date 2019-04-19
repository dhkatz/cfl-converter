#!/usr/bin/env node
import chalk from 'chalk';
import program from 'commander';
import download from 'download';
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
  .option('-P, --products <ids>', 'List of Product IDs to retrieve and convert.', (value: string) => value.split(','));

  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ cfl-converter --input product.cfl,chair.cfl');
    console.log('  $ cfl-converter --products 1243456,654321');
  });

  program.parse(process.argv);

  const products: Buffer[] = (await Promise.all((program.products || []).map(async (product: string): Promise<Buffer | null> =>  {
    for (let i = 100; i > 0; i--) {
      try {
        const file = await download(`http://userimages-akm.imvu.com/productdata/${product.trim()}/${i}`);

        return Buffer.from(file);
      } catch {
        continue;
      }
    }

    return null;
  })) as Array<Buffer | null>).filter((value: Buffer | null) => value != null);

  const inputs: Array<string | Buffer> = [...program.input || [], ...products];

  console.log(chalk.yellowBright(`Beginning processing on ${inputs.length} file${inputs.length > 1 ? 's' : ''}. . .\n`));

  let count = 0;
  for (const input of inputs) {
    if (typeof input === 'string' && !input.toLocaleLowerCase().endsWith('.cfl')) {
      console.log(chalk.redBright('This program only supports files ending with the .CFL extension!'));
      return;
    }

    console.log(chalk.blueBright(`Processing '${typeof input === 'string' ? input : 'download'}'. . .`));

    const reader = new BinaryReader(typeof input === 'string' ? fs.readFileSync(input.trim()) : input);

    // CFL Header
    // This information is exclusive to the CFL format

    const hashed = reader.readChars(4, Encoding.Utf8) === 'DFL3';

    reader.position = reader.readUnsignedInt();

    const format = reader.readInt();

    console.log(chalk.greenBright('\tDecoded CFL header.'));

    // Decompress the LZMA section of the CFL file
    const content = Uint8Array.from([...Array(reader.readInt())].map(() => reader.readByte()));
    const data = new BinaryReader(format === 4 ? decompress(content) : content);

    console.log(chalk.greenBright('\tDecompressed CFL content.'));

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

    console.log(chalk.greenBright(`\tParsed ${entries.length} CFL ${entries.length !== 1 ? 'entries' : 'entry'}.`));

    count++;

    const zip = new JSZip();

    entries.forEach((entry: CFLEntry) => {
      zip.file(entry.name, entry.contents);
    });

    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(fs.createWriteStream(`${typeof input === 'string' ? input.slice(0, -4) : count}.chkn`))
      .on('close', () => console.log(chalk.greenBright(`\tWrote to ${typeof input === 'string' ? input.slice(0, -4) : count}.chkn.\n`)));
  }

  console.log(`Finished processing ${inputs.length} file${inputs.length > 1 ? 's' : ''}!`);
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
