var gulp = require('gulp');
var concat = require('gulp-concat');
var sass = require('gulp-sass')(require('node-sass'));
var minify = require('gulp-minify');
var cleanCss = require('gulp-clean-css');
var rename = require('gulp-rename');
//sass.compiler = require('node-sass');


gulp.task('watch', async function() {
  gulp.watch(['static/css/*.scss','static/css/*.css' ], gulp.series(['pack-css']));
  gulp.watch('static/js/*.js', gulp.series(['pack-js']));
  //gulp.watch('static/css')
})

function defaultTask(cb) {
  // place code for your default task here
  cb();
}


gulp.task('pack-css', () => {
  return gulp.src(['static/css/*.scss', 'static/css/*.css'])
    .pipe(sass().on('error', sass.logError))
    .pipe(cleanCss())
    .pipe(concat('styles.css'))
    .pipe(rename('styles.min.css'))
    .pipe(gulp.dest('static/prod'));
})


gulp.task('pack-js', () => {
  return gulp.src('static/js/*.js')
    .pipe(minify({
      ext: {
        min:'.min.js'
      },
      noSource:true
    }))
    .pipe(gulp.dest('static/prod'));
});


exports.default = defaultTask