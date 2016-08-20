const through = require('through2');
const gutil = require('gulp-util');
const PluginError = gutil.PluginError;
const versioner = require('./versioner');

const PLUGIN_NAME = 'gulp-res-version';

function resVersion(opts) {
    // 创建一个让每个文件通过的 stream 通道
    return through.obj((file, enc, cb) => {
        if (file.isNull()) {
            return cb(null, file);
        }

        if (file.isStream()) {
            return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
        }

        versioner(file, opts);

        cb(null, file);
    });
}

module.exports = resVersion;