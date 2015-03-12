var https = require('https');
var fs = require('fs');
var setting = require('./setting');
var popularity = require('./popularity');

module.exports = Hangman;

function Hangman() {
  this.invalidSet_ = {};
  this.currentNumberOfGuess_ = 0;
  this.gameContext_ = {};
  this.dict_ = [];
  this.currentSubDict_ = [];
}

Hangman.prototype.play = function () {
  var self = this;
  self.loadDict();
  self.startGame(function () {
    self.nextRound();
  });
};

Hangman.prototype.nextRound = function () {
  var self = this;
  self.giveMeAWord(function () {
    self.buildSubDictOfLength(self.gameContext_['currentWord'].length);
    self.nextGuess();
  });
};

Hangman.prototype.nextGuess = function () {
  var self = this;
  self.makeAGuess(function (guess) {
    if (self.guessFinish()) {
      if (self.allFinished()) {
        self.getResult();
      }
      else {
        self.nextRound();
      }
    } else if (self.failed()) {
      self.getResult();
      self.nextRound(); //////
    } else if (self.guessWrong()) {
      self.reduceCurrentSubDictByChar(guess);
      self.nextGuess();
    } else {
      self.reduceCurrentSubDictByWord(self.gameContext_['currentWord']);
      self.nextGuess();
    }
  })
};

Hangman.prototype.startGame = function (callback) {
  var self = this;
  this.sendRequest(this.generateStartGameRequest(setting.playerId), function (err, response) {
    if (err) {
      throw err;
    }
    console.log('start game response: ' + response);
    var responseObj = JSON.parse(response);
    self.gameContext_['sessionId'] = responseObj['sessionId'];
    self.gameContext_['numberOfWordsToGuess'] = responseObj['data']['numberOfWordsToGuess'];
    self.gameContext_['numberOfGuessAllowedForEachWord'] = responseObj['data']['numberOfGuessAllowedForEachWord'];
    if (callback) {
      callback();
    }
  })
};

Hangman.prototype.giveMeAWord = function (callback) {
  var self = this;
  this.invalidSet_ = {};
  this.currentNumberOfGuess_ = 0;
  this.sendRequest(this.generateGiveMeAWordRequest(this.gameContext_['sessionId']), function (err, response) {
    if (err) {
      throw err;
    }
    console.log('give me a word response:' + response);
    var responseObj = JSON.parse(response);
    self.gameContext_['currentWord'] = responseObj['data']['word'];
    self.gameContext_['totalWordCount'] = responseObj['data']['totalWordCount'];
    self.gameContext_['wrongGuessCountOfCurrentWord'] = responseObj['data']['wrongGuessCountOfCurrentWord'];
    if (callback) {
      callback();
    }
  })
};

Hangman.prototype.makeAGuess = function (callback) {
  var self = this;
  var nextGuess = this.guess();
  console.log('next guess: ' + nextGuess);
  this.currentNumberOfGuess_ = this.currentNumberOfGuess_ + 1;
  this.invalidSet_[nextGuess] = true;
  this.sendRequest(this.generateMakeAGuessRequest(this.gameContext_['sessionId'], nextGuess), function (err, response) {
    console.log('make a guess response:' + response);
    var responseObj = JSON.parse(response);
    self.gameContext_['previousWord'] = self.gameContext_['currentWord'];
    self.gameContext_['currentWord'] = responseObj['data']['word'];
    self.gameContext_['totalWordCount'] = responseObj['data']['totalWordCount'];
    self.gameContext_['wrongGuessCountOfCurrentWord'] = responseObj['data']['wrongGuessCountOfCurrentWord'];
    if (callback) {
      callback(nextGuess);
    }
  });
};

Hangman.prototype.getResult = function (callback) {
  var self = this;
  this.sendRequest(this.generateGetResultRequest(this.gameContext_['sessionId']), function (err, response) {
    if (err) {
      throw err;
    }
    console.log('get result response:' + response);
    var responseObj = JSON.parse(response);
    self.gameContext_['correctWordCount'] = responseObj['data']['correctWordCount'];
    self.gameContext_['totalWordCount'] = responseObj['data']['totalWordCount'];
    self.gameContext_['totalWrongGuessCount'] = responseObj['data']['totalWrongGuessCount'];
    self.gameContext_['score'] = responseObj['data']['score'];
    if (callback) {
      callback();
    }
  })
};

Hangman.prototype.submitResult = function () {

};

Hangman.prototype.sendRequest = function (requestBody, callback) {
  var self = this;
  var requestStr = JSON.stringify(requestBody);
  var postOptions = {
    host: setting.host,
    path: setting.path,
    port: setting.port,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': requestStr.length
    }
  };

  // Set up the request
  var req = https.request(postOptions, function (res) {
    res.setEncoding('utf8');
    var responseBody = '';
    res.on('data', function (chunk) {
      responseBody += chunk;
    });

    res.on('end', function () {
      if (res.statusCode >= 400) {
        console.warn('sth wrong in server, response status code: ' + res.statusCode);
        console.warn('response body: ' + responseBody);
        console.warn('request body:' + requestStr);

      } else if (callback) {
        //err the first parameter
        callback(null, responseBody);
      }
    });

    res.on('error', function (e) {
      console.error(e);
      if (callback) {
        callback(e);
      }
    })
  });

  req.on('error', function (e) {
    console.error(e);
  });

  // post the data
  req.write(requestStr);
  req.end();
};

Hangman.prototype.generateGiveMeAWordRequest = function (sessionId) {
  return {
    'sessionId': sessionId,
    'action': 'nextWord'
  }
};

Hangman.prototype.generateMakeAGuessRequest = function (sessionId, guess) {
  return {
    'sessionId': sessionId,
    'action': 'guessWord',
    'guess': guess
  }
};

Hangman.prototype.generateStartGameRequest = function (playerId) {
  return {
    'playerId': playerId,
    'action': 'startGame'
  };
};

Hangman.prototype.generateGetResultRequest = function (sessionId) {
  return {
    'sessionId': sessionId,
    'action': 'getResult'
  }
};

Hangman.prototype.generateSubmitResultRequest = function (sessionId) {
  return {
    'sessionId': sessionId,
    'action': 'submitResult'
  }
};

Hangman.prototype.loadDict = function () {
  var self = this;
  var dictArray = fs.readFileSync(setting.dictPath, {encoding: 'utf8'}).split('\n');
  dictArray.forEach(function (word) {
    if (!self.dict_[word.length]) {
      self.dict_[word.length] = [];
    }
    self.dict_[word.length].push(word);
  })
};

Hangman.prototype.buildSubDictOfLength = function (length) {
  this.currentSubDict_ = this.dict_[length].slice();
};

Hangman.prototype.reduceCurrentSubDictByWord = function (toBeGuessed) {
  var negatedSetReg = '[^';
  for(var i = 0; i < toBeGuessed.length; ++i){
    if(negatedSetReg.indexOf(toBeGuessed[i]) === -1 && toBeGuessed[i] !== '*'){
      negatedSetReg += toBeGuessed[i];
    }
  }
  negatedSetReg += ']';
  var regex = toBeGuessed.replace(/\*/g, negatedSetReg);
  this.currentSubDict_ = this.currentSubDict_.filter(function (word) {
    return word.match(regex);
  });
  if (this.currentSubDict_.length === 0) {
    console.warn('no candidate in dict: ' + this.gameContext_['currentWord']);
    this.nextRound();
  }
};

Hangman.prototype.reduceCurrentSubDictByChar = function (character) {
  this.currentSubDict_ = this.currentSubDict_.filter(function (word) {
    return word.indexOf(character) === -1;
  });
  if (this.currentSubDict_.length === 0) {
    console.warn('no candidate in dict: ' + this.gameContext_['currentWord']);
    this.nextRound();
  }
};

Hangman.prototype.upgradeDictionary = function(){

};

Hangman.prototype.getMostPossibleChar = function (tobeGuessed) {
  var alphaMap = {'A': 0};
  var tmp = {};
  var result = 'A';

  this.currentSubDict_.forEach(function (word) {
    tmp = {};
    for (var i = 0; i < word.length; ++i) {
      if (tobeGuessed.indexOf(word[i]) === -1) {
        tmp[word[i]] = true;
      }
    }
    for (var alpha in tmp) {
      if (tmp.hasOwnProperty(alpha)) {
        alphaMap[alpha] = alphaMap[alpha] ? alphaMap[alpha] + 1 : 1;
        if (alphaMap[alpha] > alphaMap[result]) {
          result = alpha;
        }
      }
    }
  });
  return result;
};

Hangman.prototype.guess = function () {
  var curWord = this.gameContext_['currentWord'];
  var guess = this.getMostPossibleChar(curWord);
  return guess;
  //return popularity[this.gameContext_['currentWord'].length][this.currentNumberOfGuess_];
};

Hangman.prototype.guessFinish = function () {
  return this.gameContext_['currentWord'].indexOf('*') === -1
};

Hangman.prototype.guessWrong = function () {
  return this.gameContext_['currentWord'] === this.gameContext_['previousWord'];
};

Hangman.prototype.allFinished = function () {
  return this.gameContext_['totalWordCount'] === this.gameContext_['correctWordCount'];
};

Hangman.prototype.failed = function () {
  return this.gameContext_['wrongGuessCountOfCurrentWord'] === this.gameContext_['numberOfGuessAllowedForEachWord'];
};

