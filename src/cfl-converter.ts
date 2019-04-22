#!/usr/bin/env node
import fs from 'fs';

import { convert } from '.';

async function main() {
  let program;
  let download;

  try {
    program = (await import('commander')).default;
    download = (await import('download')).default;
  } catch {
    console.error('One or more optional dependencies is missing! Please install them first.');
    process.exit(1);
  }

  program
  .version('0.0.1')
  .option('-I, --input <files>', '.CFL file(s) to convert.', (value: string): string[] => value.split(','), [])
  .option('-P, --products <ids>', 'List of Product IDs to retrieve and convert.', (value: string) => value.split(','), [])
  .option('-Q, --quiet', 'Stop the program from logging progress.', Boolean, false)
  .option('-D, --dry-run', 'Skip outputting to a file and just attempt to convert.', Boolean, false)
  .option('--ignore-missing', 'Ignore IDs that point to non-existant products.', Boolean, false)
  .option('--ignore-extension', 'Attempt to process all files regardless of extension.', Boolean, false);

  program.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ cfl-converter --input product.cfl,chair.cfl');
    console.log('  $ cfl-converter --products 1243456,654321');
  });

  program.parse(process.argv);

  async function downloadProduct(id: number | string): Promise<ArrayBufferLike | null> {
    for (let i = 100; i > 0; i--) {
      try {
        const file = await download(`http://userimages-akm.imvu.com/productdata/${typeof id === 'number' ? id : id.trim()}/${i}`);

        return Buffer.from(file);
      } catch {
        continue;
      }
    }

    return null;
  }

  const options = {
    input: program.input as string[],
    log: !program.quiet,
    products: program.products as string[],
  };

  if (options.products.length > 0 && options.log) {
    console.log(`Downloading ${options.products.length} CFL files...\n`);
  }

  const products = await Promise.all(options.products.map(downloadProduct));

  if (!program.ignoreMissing) {
    products.forEach((value) => {
      if (value == null) {
        console.error('One or more CFLs failed to download! (Use the --ignore-missing flag to override)');
      }
    });
  }

  if (!program.ignoreExtension) {
    options.input.forEach((value) => {
      if (!value.toLocaleLowerCase().endsWith('.cfl')) {
        console.error('This program only supports files with the .CFL extension! (Use the --ignore-extension flag to override)');
        process.exit(1);
      }
    });
  }

  const inputs = [...options.input.map((input) => fs.readFileSync(input.trim())), ...products];
  const names = [...options.input.map((input) => input.toLocaleLowerCase().endsWith('.cfl') ? input.slice(0, -4) : input), ...options.products];

  if (options.log) {
    console.log(`Beginning processing on ${inputs.length} file(s). . .\n`);
  }

  await Promise.all(inputs.map(async (input, index) => {
    if (input == null) {
      return;
    }

    if (options.log) {
      console.log(`Processing file ${names[index]}. . .`);
    }

    try {
      const file = await convert(input, { log: options.log });

      if (!program.dryRun) {
        fs.writeFileSync(`${names[index]}.chkn`, file);
        if (options.log) {
          console.log(`Wrote to ${names[index]}.chkn.\n`);
        }
      } else if (options.log) {
        console.log(`Successfully converted ${names[index]}.\n`);
      }
    } catch {
      console.log(`Failed processing ${names[index]}!\n`);
    }
  }));

  if (options.log) {
    console.log(`Finished processing ${inputs.length} file(s)!`);
  }
}

main();
