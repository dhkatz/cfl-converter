# IMVU CFL Converter

[![Build Status](https://travis-ci.com/dhkatz/cfl-converter.svg?branch=master)](https://travis-ci.com/dhkatz/cfl-converter)

Convert from IMVU's CFL format to a file usable by the IMVU client create mode (.chkn).

In reality, a .chkn file is just a zip archive and can be opened as such.

Inspired by https://github.com/Toyz/LibCFL

## Usage

Convert .cfl files to .chkn files using this easy command-line tool!

Product IDs can also be supplied and the program will attempt to download them and convert them.

```
Usage: cfl-converter [options]

Options:
  -V, --version         output the version number
  -I, --input <files>   .CFL file(s) to convert.
  -P, --products <ids>  List of Product IDs to retrieve and convert.
  -h, --help            output usage information

Examples:
  $ cfl-converter --input product.cfl,chair.cfl
  $ cfl-converter --products 1243456,654321
```

## Testing

Testing is currently being written, although the program itself is quite simple.

## Details

The signifiance of this is, that due to what I can only call an exploit of IMVU's CDN, you can download the CFL for ANY product in the shop!

This can be accomplished by running the product ID through the url `http://userimages-akm.imvu.com/productdata/{productID}/1` where `{productID}` is the ID of the product you with to retrieve. 

The number at the end seems to be the revision number, so you may want to check if numbers higher than 1 work as well and get the highest revision you can.

After, simply save the downloaded file with a .cfl extension and use this tool to convert it to a CHKN file.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Links

 * [Travis-ci](https://travis-ci.com/dhkatz/cfl-converter) 
