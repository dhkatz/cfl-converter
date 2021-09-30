#!/usr/bin/env node
import fs from 'fs'

import { convert } from '.'

import { buffer as toBuffer } from 'get-stream'
import { Command } from 'commander'
import download from 'download'
import JSZip from 'jszip'

interface Options {
  input: string[]
  quiet: boolean
  products: string[]
  ignoreMissing: boolean
  ignoreExtension: boolean
  dryRun: boolean
}

async function main() {
  const program = new Command()

  program
    .version('2.0.1')
    .option(
      '-I, --input <files>',
      '.CFL file(s) to convert.',
      (value: string): string[] => value.split(','),
      []
    )
    .option(
      '-P, --products <ids>',
      'List of Product IDs to retrieve and convert.',
      (value: string) => value.split(','),
      []
    )
    .option('-Q, --quiet', 'Stop the program from logging progress.', Boolean, false)
    .option(
      '-D, --dry-run',
      'Skip outputting to a file and just attempt to convert.',
      Boolean,
      false
    )
    .option('--ignore-missing', 'Ignore IDs that point to non-existent products.', Boolean, false)
    .option(
      '--ignore-extension',
      'Attempt to process all files regardless of extension.',
      Boolean,
      false
    )

  program.on('--help', () => {
    console.log('')
    console.log('Examples:')
    console.log('  $ cfl-converter --input product.cfl,chair.cfl')
    console.log('  $ cfl-converter --products 1243456,654321')
  })

  program.parse(process.argv)

  if (process.argv.length < 3) {
    program.help()
  }

  const options = program.opts<Options>()

  async function downloadProduct(id: number | string): Promise<Buffer | null> {
    const pid = typeof id === 'number' ? id : id.trim()
    let i = 100
    for (; i > 0; i--) {
      try {
        const file = await download(`https://userimages-akm.imvu.com/productdata/${pid}/${i}`)

        if (file.length > 0) break
      } catch {}
    }

    if (i === 0) return null

    const contents = await download(
      `https://userimages-akm.imvu.com/productdata/${pid}/${i}/_contents.json`
    )
    const manifest = JSON.parse(contents.toString())

    const zip = new JSZip()

    for (const file of manifest) {
      const url = file.url ?? file.name
      console.log(`Downloading https://userimages-akm.imvu.com/productdata/${pid}/${i}/${url}`)
      const data = await download(`https://userimages-akm.imvu.com/productdata/${pid}/${i}/${url}`)

      zip.file(file.name, data)
    }

    return toBuffer(zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }))
  }

  if (options.products.length > 0 && !options.quiet) {
    console.log(`Downloading ${options.products.length} CFL files...\n`)
  }

  const products = await Promise.all(options.products.map(downloadProduct))

  if (!options.ignoreMissing) {
    products.forEach((value) => {
      if (value == null) {
        console.error(
          'One or more CFLs failed to download! (Use the --ignore-missing flag to override)'
        )
      }
    })
  }

  products.forEach((product, i) => {
    if (!options.dryRun) {
      fs.writeFileSync(`${options.products[i]}.chkn`, product)

      if (!options.quiet) {
        console.log(`Wrote to '${options.products[i]}.chkn'.\n`)
      }
    } else if (!options.quiet) {
      console.log(`Successfully downloaded '${options.products[i]}'.\n`)
    }
  })

  if (!options.quiet && options.products.length > 0) {
    console.log(`Successfully downloaded ${options.products.length} file(s)!`)
  }

  if (!options.ignoreExtension) {
    options.input.forEach((value) => {
      if (!value.toLocaleLowerCase().endsWith('.cfl')) {
        console.error(
          'This program only supports files with the .CFL extension! (Use the --ignore-extension flag to override)'
        )
        process.exit(1)
      }
    })
  }

  const inputs = options.input.map((input) => fs.readFileSync(input.trim()))
  const names = options.input.map((input) =>
    input.toLocaleLowerCase().endsWith('.cfl') ? input.slice(0, -4) : input
  )

  if (!options.quiet && inputs.length > 0) {
    console.log(`Beginning processing on ${inputs.length} file(s). . .\n`)
  }

  await Promise.all(
    inputs.map(async (input, index) => {
      if (input == null) {
        return
      }

      if (!options.quiet) {
        console.log(`Processing file ${names[index]}. . .`)
      }

      try {
        const file = await convert(input, { log: !options.quiet })

        if (!options.dryRun) {
          fs.writeFileSync(`${names[index]}.chkn`, file)
          if (!options.quiet) {
            console.log(`Wrote to '${names[index]}.chkn'.\n`)
          }
        } else if (!options.quiet) {
          console.log(`Successfully converted '${names[index]}'.\n`)
        }
      } catch {
        console.log(`Failed processing '${names[index]}'!\n`)
      }
    })
  )

  if (!options.quiet && inputs.length > 0) {
    console.log(`Finished processing ${inputs.length} file(s)!`)
  }
}

main()
