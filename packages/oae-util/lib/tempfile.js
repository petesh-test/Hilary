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

const fs = require('fs');
const Path = require('path');
const Temp = require('temp');

const log = require('oae-logger').logger('TempFile');

/**
 * Allows you to set the directory in which the temporary files will be generated.
 *
 * @param  {String}     directory   The base directory for temp files as generated by `createTempFile`.
 */
const init = function(directory) {
    Temp.dir = directory;
};

/**
 * A model to represent temporary files.
 *
 * @param  {String} path The path to the temp file.
 * @param  {Number} size The filesize of this temporary file in bytes.
 */
const TempFile = function(path, size) {
    const that = {};
    that.path = path;
    that.size = size;
    that.name = Path.basename(path);

    /**
     * Remove the temporary file.
     *
     * @param  {Function}    callback        Standard callback function
     * @param  {Object}      callback.err    An error that occurred, if any
     */
    that.remove = function(callback) {
        fs.unlink(that.path, (err) => {
            if (err) {
                log().error({err}, 'Could not remove temporary file: %s', that.path);
                return callback({'code': 500, 'msg': 'Could not remove temporary file ' + that.path});
            }
            callback();
        });
    };

    /**
     * Updates the metadata of a temp file.
     *
     * @param  {Function}    callback        Standard callback function
     * @param  {Object}      callback.err    An error that occurred, if any
     * @param  {Object}      callback.file   Returns the updated temp file (a reference to it self.)
     */
    that.update = function(callback) {
        fs.stat(that.path, (err, stat) => {
            if (err) {
                log().error({err}, 'Could not stat the file: %s', that.path);
                return callback({'code': 500, 'msg': err});
            }

            that.size = stat.size;
            callback(null, that);
        });
    };

    return that;
};

/**
 * Create a new temporary file. The temp path generation is a wrapper around Bruce Williams node-temp's `Temp.path` method.
 * You can pass in optional suffices.
 *
 * @see https://github.com/bruce/node-temp
 * @param  {Object}     [options]   An option suffix
 * @return {TempFile}
 */
const createTempFile = function(options) {
    options = options || {};
    const tempPath = Temp.path(options);
    return new TempFile(tempPath, 0);
};


module.exports = {
init ,
TempFile ,
createTempFile 

};
