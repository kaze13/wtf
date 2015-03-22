var fs = require('fs');

cleanDict('wtf');

function cleanDict(path) {
  var content = fs.readFileSync(path, {encoding: 'utf8'});
  var processed = content.split('\n').filter(function (word) {
    return word.match(/^[a-z]+$/);
  }).map(function (word) {
    return word.toUpperCase();
  }).join('\n');
  fs.writeFileSync('./dict/' + path, processed);
}