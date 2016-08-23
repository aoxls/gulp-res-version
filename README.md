# gulp-res-version

Append hash version code to the resource references in html and css files.

## Installation

	npm install gulp-res-version --save-dev

## Usage

```javascript
const resversion = require('gulp-res-version');

gulp.task('prd', () => {
    gulp.src(['./build/**/*.html', './build/**/*.css'])
        .pipe(resversion({
            rootdir: './build/',
            ignore: [/#data$/i]
        }))
        .pipe(gulp.dest('./build/'));
});
```

Input

```html
<link rel="stylesheet" href="/css/index.css"/>
<script src="/js/common.js"></script>
```

```css
.bg { background:url(images/bg.png);}
```

Output

```html
<link rel="stylesheet" href="/css/index.css?v=731fb82c"/>
<script src="/js/common.js?v=be300b8f"></script>
```

```css
.bg { background:url(images/bg.png?v=4d9e3819);}
```

## Options

### rootdir
Type: `String`

path of root directory, relative to the gulpfile, useful for the absolute paths like '/css/index.css'

### ignore
Type: `Array`

Array of RegExps

### qskey
Type: `String`

Default: `'v'`

key name of querystring to append