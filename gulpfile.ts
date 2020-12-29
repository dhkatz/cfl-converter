import del from 'del';

import sourcemaps from 'gulp-sourcemaps';
import typescript from 'gulp-typescript';
import merge from 'merge2';
import path from 'path';

import { dest, series, src, watch } from 'gulp';
import { CompileStream } from 'gulp-typescript';

const project = typescript.createProject('tsconfig.json', { declarationFiles: true });
const destination = 'build/';

function build() {
  del.sync([`${destination}**/*.*`]);

  const compiled: CompileStream = src(['src/**/*.ts'])
    .pipe(sourcemaps.init())
    .pipe(project());

  return merge([
    compiled.js
    .pipe(sourcemaps.write({ sourceRoot: (file) => path.relative(path.join(file.cwd, file.path), file.base) }))
    .pipe(dest(destination)),
    compiled.dts
      .pipe(dest(destination)),
  ]);
}

function update() {
  watch('src/**/*.ts', series(build));
}

exports.build = series(build);
exports.watch = series(build, update);
exports.default = series(build);
