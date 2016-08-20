const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const gutil = require('gulp-util');
const PluginError = gutil.PluginError;
const htmlparser = require('htmlparser2');

const PLUGIN_NAME = 'gulp-res-version';

class Versioner {
    constructor(file, options) {
        this.file = file;
        this.content = file.contents.toString();
        this.path = file.path;
        this.base = file.base;
        this.cwd = file.cwd;
        this.extname = path.extname(file.path).substr(1);

        this.opts = Object.assign({
            rootdir: file.cwd, // 以"/"开头的引用所对应的目录
            ignore: [],
            qskey: 'v' // 添加的查询字符串键名
        }, options);

        this.process();
    }

    /**
     * 处理流程
     */
    process() {
        let references = [];
        // 提取引用
        if (this.extname === 'html') {
            references = this.parseHtml();
        }
        if (this.extname === 'css') {
            references = this.parseCss();
        }
        // 添加hash
        this.replaceReferences(references);
        // 完成
        this.file.contents = Buffer.from(this.content);
    }

    /**
     * 解析html文件,提取引用
     */
    parseHtml() {
        let references = [];
        let parser = new htmlparser.Parser({
            onopentag: (tag, attrs) => {
                // 提取引用路径
                let refurl;
                if (tag === 'script' || tag === 'img') {
                    refurl = attrs.src;
                }
                if (tag === 'link' && attrs.href && attrs.href.indexOf('.css') > -1) {
                    refurl = attrs.href;
                }
                // 跳过不需处理的引用
                if (!this.isIgnored(refurl)) {
                    references.push(refurl);
                }
            }
        }, {decodeEntities: true});
        parser.write(this.content);
        parser.end();

        return references;
    }

    /**
     * 解析css文件，提取引用
     */
    parseCss() {
        let reg = /url\(['"]?(?!data)([^\)'"]*)['"]?\)/ig,
            references = [], m;

        while (m = reg.exec(this.content)) {
            let refurl = m[1];
            if (!this.isIgnored(refurl)) {
                references.push(refurl);
            }
        };

        return references;
    }

    /**
     * 判断引用是否需要处理
     * @param refurl
     */
    isIgnored(refurl) {
        if (!refurl || refurl === '' || /^http|^data:/ig.test(refurl)) {
            return true;
        }
        // 用户定义的忽略正则
        let result = false;
        this.opts.ignore.forEach((reg) => {
            result = reg.test(refurl);
        });
        return result;
    }

    /**
     * 替换加入hash值的引用路径
     * @param references
     */
    replaceReferences(references) {
        references.forEach((refurl) => {
            let refpath = this.getRefPath(refurl),
                refurlObj = url.parse(refurl, true),
                reg = new RegExp(this.escapeRegExp(refurl), 'ig'),
                refbuf, refhash, targeturl;

            try {
                refbuf = fs.readFileSync(url.parse(refpath).pathname);
            }
            catch(e) {
                return gutil.log(gutil.colors.yellow(PLUGIN_NAME), 'Load file failed: "' + refurl + '" in "' + this.path + '"');
            }

            refhash = this.getFileHash(refbuf);
            // 将hash值添加到querystring中
            refurlObj.query[this.opts.qskey] = refhash;
            refurlObj.search = '';
            targeturl = url.format(refurlObj);

            // 替换
            this.content = this.content.replace(reg, targeturl);
        });
    }

    /**
     * 获取文件的哈希值
     * @param buf
     * @returns {String}
     */
    getFileHash(buf) {
        return crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
    }

    /**
     * 根据代码中的引用地址，获取引用文件的物理路径
     * @param refurl
     * @returns {String}
     */
    getRefPath(refurl) {
        if (!/^\.|^\//ig.test(refurl)) {
            refurl = './' + refurl;
        }
        if (refurl.indexOf('./') === 0 || refurl.indexOf('../') === 0) {
            return path.resolve(path.dirname(this.path), refurl);
        }
        if (refurl.indexOf('/') === 0) {
            refurl = refurl.substr(1);
            return path.resolve(this.cwd, this.opts.rootdir, refurl);
        }
        return null;
    };

    /**
     * 转义正则字符串
     * @param str
     * @returns {String}
     */
    escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
    }
}

module.exports = (file, options) => new Versioner(file, options);