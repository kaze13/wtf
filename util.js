var fs = require('fs');

cleanDict('/home/minli/dict.txt');
function cleanDict(path) {
  var content = fs.readFileSync(path, {encoding: 'utf8'});
  var processed = content.split('\n').filter(function (word) {
    return word.match(/^[a-zA-Z]+$/);
  }).map(function (word) {
    return word.toUpperCase();
  }).join('\n');
  fs.writeFileSync('/home/minli/dict.txt', processed);
}