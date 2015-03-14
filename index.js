var Hangman = require('./hangman');
var option = require('./setting.json');

var hangman = new Hangman(option);
hangman.play();

Error.stackTraceLimit = Infinity;
