const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const gutil = require('gulp-util');
const PluginError = gutil.PluginError;
const htmlparser = require('htmlparser2');

const PLUGIN_NAME = 'gulp-res-version';

class Versioner {
    constructor(file, map, options) {
        this.file = file;
        this.map = map;
        this.content = file.contents.toString();
        this.path = file.path;
        this.base = file.base;
        this.cwd = file.cwd;
        this.extname = path.extname(file.path).substr(1);

        this.opts = Object.assign({
            rootdir: file.cwd, // 以"/"开头的引用所对应的目录
            ignore: [], // 忽略的正则数组
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
                if ((tag === 'script' || tag === 'img') && attrs.src) {
                    refurl = attrs.src.trim();
                }
                if (tag === 'link' && attrs.href && attrs.href.indexOf('.css') > -1) {
                    refurl = attrs.href.trim();
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
        let reg = /url\(\s*['"]?([^'":;,\s}]*)['"]?\s*\)/ig,
            content = this.content.replace(/\/\*[\s\S]*?\*\//ig, ''), // 去除注释
            references = [], m;

        while (m = reg.exec(content)) {
            let refurl = m[1].trim();
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
        if (!refurl || refurl === '' || /^http|^data:|about:blank/ig.test(refurl)) {
            return true;
        }
        // 用户定义的忽略正则
        let result = false;
        for (let reg of this.opts.ignore) {
            result = reg.test(refurl);
        }
        return result;
    }

    /**
     * 替换加入hash值的引用路径
     * @param references
     */
    replaceReferences(references) {
        for (let refurl of references) {
            let refpath = this.getRefPath(refurl),
                refurlObj = url.parse(refurl, true),
                reg = new RegExp(this.escapeRegExp(refurl), 'ig'),
                refbuf, refhash, targeturl;

            if (this.map[refpath]) {
                refhash = this.map[refpath];
            }
            else {
                try {
                    refbuf = fs.readFileSync(refpath);
                }
                catch(e) {
                    return gutil.log(gutil.colors.yellow(PLUGIN_NAME), 'Load file failed: "' + refurl + '" in "' + this.path + '"');
                }
                refhash = this.getFileHash(refbuf);
                // 缓存文件的hash值
                this.map[refpath] = refhash;
            }

            // 将hash值添加到querystring中
            refurlObj.query[this.opts.qskey] = refhash;
            refurlObj.search = '';
            targeturl = url.format(refurlObj);

            // 替换
            this.content = this.content.replace(reg, targeturl);
        }
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
        let result = '';

        if (!/^\.|^\//ig.test(refurl)) {
            refurl = './' + refurl;
        }
        if (refurl.indexOf('./') === 0 || refurl.indexOf('../') === 0) {
            result = path.resolve(path.dirname(this.path), refurl);
        }
        if (refurl.indexOf('/') === 0) {
            refurl = refurl.substr(1);
            result = path.resolve(this.cwd, this.opts.rootdir, refurl);
        }

        return url.parse(result).pathname;
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

module.exports = (file, map, options) => new Versioner(file, map, options);