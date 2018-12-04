/*!
 * Copyright 2014 Apereo Foundation (AF) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const { exec } = require('child_process');
const fs = require('fs');
const util = require('util');
const gm = require('gm');
const less = require('less');
const _ = require('underscore');

const log = require('oae-logger').logger('oae-preview-processor');
const OaeUtil = require('oae-util/lib/util');

const PreviewConstants = require('oae-preview-processor/lib/constants');
const PreviewUtil = require('oae-preview-processor/lib/util');

let _pdf2htmlEXBinary = null;
let _pdf2htmlEXTimeout = 120000;

let _pdftotextBinary = null;
let _pdftotextTimeout = 120000;

// LESS template used to combine the CSS files generated by pdf2htmlEX into
// a single CSS file and scope the CSS rules to the generated preview instead of
// the full OAE page
let _pdf2htmlLessTemplate = null;
const _pdf2htmlLessTemplatePath = util.format(
  '%s/../../../lessTemplates/pdf2html.less.jst',
  __dirname
);

/**
 * Initializes the PDF Processor. This method will check if the configuration has been set up correctly to deal with PDF files
 *
 * @param  {Object}     config          The config object containing the `pdftotext` and `pdf2htmlEX` configuration. See the `config.previews` object in the base `./config.js` for more information
 * @param  {Function}   callback        Standard callback function
 * @param  {Object}     callback.err    An error that occurred, if any
 */
const init = function(config, callback) {
  if (
    !config ||
    !config.pdftotext ||
    !config.pdftotext.binary ||
    !config.pdf2htmlEX ||
    !config.pdf2htmlEX.binary
  ) {
    return callback({
      code: 400,
      msg: 'Missing configuration for the pdftotext and/or pdf2htmlEX binary'
    });
  }

  // Try to execute `pdf2htmlEX --version`
  let cmd = util.format('%s --version', config.pdf2htmlEX.binary);
  log().trace(
    'Executing %s to verify if the path to the pdf2htmlEX binary is configured correctly.',
    cmd
  );
  exec(cmd, { timeout: _pdf2htmlEXTimeout }, (err, stdout, stderr) => {
    if (err) {
      log().error({ err, stdout, stderr }, 'Could not properly execute the pdf2htmlEX binary');
      return callback({ code: 500, msg: 'The path for the pdf2htmlEX binary is misconfigured' });
    }

    _pdf2htmlEXBinary = config.pdf2htmlEX.binary;
    _pdf2htmlEXTimeout = OaeUtil.getNumberParam(config.pdf2htmlEX.timeout, _pdf2htmlEXTimeout);

    // Try to execute `pdftotext -v`
    cmd = util.format('%s -v', config.pdftotext.binary);
    log().trace(
      'Executing %s to verify if the path to the pdftotext binary is configured correctly.',
      cmd
    );
    exec(cmd, { timeout: _pdftotextTimeout }, (err, stdout, stderr) => {
      if (err) {
        log().error({ err, stdout, stderr }, 'Could not properly execute the pdftotext binary');
        return callback({ code: 500, msg: 'The path for the pdftotext binary is misconfigured' });
      }

      _pdftotextBinary = config.pdftotext.binary;
      _pdftotextTimeout = OaeUtil.getNumberParam(config.pdftotext.timeout, _pdftotextTimeout);

      // Get the template used to construct the preview CSS stylesheet. LESS will combine the
      // multiple CSS style sheets created by pdf2htmlEX into a single style sheet, and it will
      // introduce scoping into the pdf2htmlEX rules so those rules don't apply to the full OAE page
      fs.readFile(_pdf2htmlLessTemplatePath, 'utf8', (err, templateContent) => {
        if (err) {
          log().error({ err, stdout, stderr }, 'Could not read the pdf2htmlEX LESS template');
          return callback({ code: 500, msg: 'Could not read the pdf2htmlEX LESS template' });
        }

        if (templateContent) {
          try {
            _pdf2htmlLessTemplate = _.template(templateContent);
          } catch (error) {
            log().error(
              { err: error, templateContent },
              'Could not generate the pdf2html combined LESS template'
            );
            return callback({ code: 500, msg: error.message });
          }

          return callback();
        }
        return callback({
          code: 500,
          msg: 'pdf2htmlEX LESS template file ' + _pdf2htmlLessTemplatePath + ' had no content'
        });
      });
    });
  });
};

/**
 * @borrows Interface.test as PDF.test
 */
const test = function(ctx, contentObj, callback) {
  if (
    contentObj.resourceSubType === 'file' &&
    PreviewConstants.TYPES.PDF.indexOf(ctx.revision.mime) !== -1
  ) {
    callback(null, 10);
  } else {
    callback(null, -1);
  }
};

/**
 * @borrows Interface.generatePreviews as PDF.generatePreviews
 */
const generatePreviews = function(ctx, contentObj, callback) {
  // Download the file
  ctx.download((err, path) => {
    if (err) {
      return callback(err);
    }

    // Generate the previews for it
    previewPDF(ctx, path, callback);
  });
};

/**
 * Generates previews for a PDF file.
 * 1 html will be generated for each page.
 *
 * @param  {PreviewContext}      ctx             The preview context associated to this file
 * @param  {String}              path            The path where the PDF file is stored
 * @param  {Function}            callback        Standard callback function
 * @param  {Object}              callback.err    An error that occurred, if any
 */
const previewPDF = function(ctx, path, callback) {
  // Create a directory where we can store the files
  const pagesDir = ctx.baseDir + '/pages';
  fs.mkdir(pagesDir, err => {
    if (err) {
      log().error(
        { err, contentId: ctx.contentId },
        'Could not create a directory %s to store the pages in',
        pagesDir
      );
      return callback({
        code: 500,
        msg: 'Could not create a directory to store the splitted pages in'
      });
    }

    _convertPDFToHTMLPages(ctx, path, pagesDir, err => {
      if (err) {
        return callback(err);
      }
      _convertToText(ctx, path, pagesDir, err => {
        if (err) {
          return callback(err);
        }

        _generateThumbnail(ctx, path, pagesDir, callback);
      });
    });
  });
};

/**
 * Converts a PDF file at `path` to a set of HTML files.
 * An HTML file will be generated for each page in the pdf, aptly named `page.<i>.html`.
 * A single CSS file will be generated that will contain the positioning for *all* the pages.
 * All HTML and CSS files will be added to the preview context, as will as the `pageCount` metadata.
 *
 * @param  {PreviewContext}      ctx             The preview context associated to this file
 * @param  {String}              path            The path where the PDF file is stored
 * @param  {String}              pagesDir        The directory where the pages can be stored in
 * @param  {Function}            callback        Standard callback function
 * @param  {Object}              callback.err    An error that occurred, if any
 * @api private
 */
const _convertPDFToHTMLPages = function(ctx, path, pagesDir, callback) {
  const cmd = util.format(
    '%s --split-pages=1 --page-filename=page..html --embed-css=0 --css-filename=lines.css --embed-javascript=0 --fit-width=700 --no-drm=1 --dest-dir "%s" "%s"',
    _pdf2htmlEXBinary,
    pagesDir,
    path
  );
  exec(cmd, { timeout: _pdf2htmlEXTimeout }, (err, stdout, stderr) => {
    if (err) {
      log().error({ err, cmd, stdout, stderr }, 'Could not convert page to html');
      return callback({ code: 500, msg: 'Could not convert page to html' });
    }

    // Converting was succesful, get a list of files we generated
    fs.readdir(pagesDir, (err, files) => {
      if (err) {
        log().error(
          { err, contentId: ctx.contentId },
          'Could not read the %s directory to list the files',
          pagesDir
        );
        return callback({ code: 500, msg: 'Could not read the directory' });
      }

      // Only return the page HTML files, ie: page.i.html
      const htmlFiles = _.filter(files, file => {
        return file.split('.')[0] === 'page' && file.split('.').pop() === 'html';
      });

      // Add each HTML to the list of previews that should be stored.
      _.each(htmlFiles, htmlFile => {
        ctx.addPreview(pagesDir + '/' + htmlFile, 'html');
      });

      // Create a single CSS file that combines all stylesheet required
      // for the document preview and scope the the style rules so they
      // don't interfere with other elements on the OAE page
      const combinedCssPath = pagesDir + '/combined.css';

      // Generate a CSS class that will be used to scope the preview CSS rules.
      // We have to replace any colons in the parameters to ensure a valid LESS syntax
      const cssScopeClass = util.format(
        '%s-%s-pdf2html',
        ctx.contentId.replace(/:/g, '-'),
        ctx.revision.previewsId.replace(/:/g, '-')
      );
      // Process the CSS files using LESS
      const lessSource = _pdf2htmlLessTemplate({ cssScopeClass });

      // Add the CSS scope class in the preview metadata so the UI can embed the preview
      // in an element scoped with that class
      ctx.addPreviewMetadata('cssScopeClass', cssScopeClass);

      // Compile the LESS template with include paths set to the location
      // of the generated style sheets
      // eslint-disable-next-line new-cap
      const parser = less.Parser({ paths: [pagesDir] });
      parser.parse(lessSource, (err, tree) => {
        if (err) {
          log().error({ err }, 'Error combining the CSS files');
          return callback({ code: 500, msg: 'Error combining the CSS files' });
        }

        // Save the resulting output
        fs.writeFile(
          combinedCssPath,
          tree.toCSS({
            cleancss: true,
            compress: true
          }),
          err => {
            if (err) {
              log().error({ err }, 'Error saving the combined CSS file');
              return callback({ code: 500, msg: 'Error saving the combined CSS file' });
            }

            // Preserve the style sheet as part of the preview
            ctx.addPreview(combinedCssPath, 'css');

            // The amount of pages should be stored as metadata
            ctx.addPreviewMetadata('pageCount', htmlFiles.length);

            return callback();
          }
        );
      });
    });
  });
};

/**
 * Generate a thumbnail for the PDF file. This works by converting the first page
 * of the PDF to an image and then cropping a thumbnail out of it
 *
 * @param  {PreviewContext}      ctx             The preview context associated to this file
 * @param  {String}              path            The path where the PDF file is stored
 * @param  {String}              pagesDir        The directory where the pages can be stored in
 * @param  {Function}            callback        Standard callback function
 * @param  {Object}              callback.err    An error that occurred, if any
 * @api private
 */
const _generateThumbnail = function(ctx, path, pagesDir, callback) {
  // Convert the first page to a png file by executing the equivalent of
  //    gm convert +adjoin -define pdf:use-cropbox=true -density 150 -resize 2000 -quality 100 input.pdf[0] output.png
  const width = PreviewConstants.SIZES.PDF.LARGE;
  const output = pagesDir + '/page.1.png';
  gm(path + '[0]')
    .adjoin()
    .define('pdf:use-cropbox=true')
    .density(150, 150)
    .resize(width, '')
    .quality(100)
    .write(output, err => {
      if (err) {
        log().error({ err, contentId: ctx.contentId }, 'Could not convert a PDF page to a PNG');
        return callback({ code: 500, msg: 'Could not convert a PDF page to a PNG' });
      }

      // Crop a thumbnail out of the png file
      PreviewUtil.generatePreviewsFromImage(ctx, output, { cropMode: 'TOP' }, callback);
    });
};

/**
 * Convert a PDF file to plain text.
 *
 * @param  {PreviewContext}      ctx             The preview context associated to this file
 * @param  {String}              input           The PDF file to convert
 * @param  {String}              pagesDir        The path where the txt files should be written
 * @param  {Function}            callback        Standard callback function
 * @param  {Object}              callback.err    An error that occurred, if any
 * @api private
 */
const _convertToText = function(ctx, input, pagesDir, callback) {
  const output = pagesDir + '/plain.txt';
  const cmd = util.format('%s -q "%s" "%s"', _pdftotextBinary, input, output);
  // Execute the command
  log().trace({ contentId: ctx.contentId }, 'Executing %s', cmd);
  const options = {
    timeout: _pdftotextTimeout,
    env: _.defaults({ OMP_NUM_THREADS: 2 }, process.env)
  };
  exec(cmd, options, (err, stdout, stderr) => {
    if (err) {
      log().error(
        { err, contentId: ctx.contentId, stdout, stderr },
        'Could not convert the PDF to plain text'
      );
      return callback({ code: 500, msg: 'Could not convert the PDF to plain text' });
    }
    ctx.addPreview(output, 'txt');

    // Read the plain-text file
    fs.readFile(output, { encoding: 'utf8' }, (err, text) => {
      if (err) {
        log().error({ err, contentId: ctx.contentId }, 'Could not read the generated plain text');
        return callback({ code: 500, msg: 'Could not read the generated plain text' });
      }

      // Split out the plain-text file in separate pages
      const pages = text.split('\f');

      // Pdftotext sometimes generates a final empty page. As we have no use
      // for an empty page, we remove it. Note that we cannot do _.compact(pages)
      // as there might be (important) empty pages in the middle of the document
      if (!pages[pages.length - 1]) {
        pages.pop();
      }

      // If the PDF was empty we can return here
      if (_.isEmpty(pages)) {
        return callback();
      }

      const done = _.after(pages.length, callback);
      _.each(pages, (page, index) => {
        const pageName = util.format('page.%s.txt', index + 1);
        const pagePath = util.format('%s/%s', pagesDir, pageName);

        ctx.addPreview(pagePath, pageName);
        fs.writeFile(pagePath, page, done);
      });
    });
  });
};

module.exports = {
  init,
  test,
  generatePreviews,
  previewPDF
};