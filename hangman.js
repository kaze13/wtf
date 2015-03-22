var https = require('https');
var fs = require('fs');
var path = require('path');

module.exports = Hangman;

/**
 *
 * @param {Object} option
 * @constructor
 */
function Hangman(option) {
  if (!option) {
    throw new Error('option is needed');
  }
  this.option_ = option;
  this.currentNumberOfGuess_ = 0;
  this.gameContext_ = {};
  this.dict_ = [];
  this.currentDictLevel_ = 0;
  this.currentSubDict_ = [];
  this.guessedChar_ = [];
}

/**
 * auto play the game!
 */
Hangman.prototype.play = function () {
  var self = this;
  self.loadAllDict();
  self.startGame(function () {
    self.nextRound();
  });
};

/**
 * start next round
 */
Hangman.prototype.nextRound = function () {
  var self = this;
  self.guessedChar_ = [];
  self.currentDictLevel_ = 0;
  self.giveMeAWord(function () {
    self.buildSubDictOfLength(self.gameContext_['currentWord'].length);
    self.nextGuess();
  });
};

/**
 * give an another guess
 */
Hangman.prototype.nextGuess = function () {
  var self = this;
  if (self.passCurrent_) {
    self.passCurrent_ = false;
    self.nextRound();
  }
  else {
    self.makeAGuess(function (guess) {
      if (self.guessFinish()) {
        if (self.allFinished()) {
          self.getResult(function () {
            process.exit(0);
          });
        }
        else {
          self.nextRound();
        }
      } else if (self.failed()) {
        self.getResult();
        self.nextRound(); //////
      } else if (self.guessWrong()) {
        self.guessedChar_.push(guess);
        self.reduceCurrentSubDictByChars(guess);
        self.nextGuess();
      } else {
        self.reduceCurrentSubDictByWord(self.gameContext_['currentWord']);
        self.nextGuess();
      }
    })
  }
};

/**
 * start the game!
 * @param {function=} callback
 */
Hangman.prototype.startGame = function (callback) {
  var self = this;
  this.sendRequest(this.generateStartGameRequest(self.option_.playerId), function (err, response) {
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

/**
 * give me a word!
 * @param {function=} callback
 */
Hangman.prototype.giveMeAWord = function (callback) {
  var self = this;
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

/**
 * make a guess, callback will take the next guess as argument
 * @param {function=} callback
 */
Hangman.prototype.makeAGuess = function (callback) {
  var self = this;
  var nextGuess = this.guess();
  console.log('next guess: ' + nextGuess);
  this.currentNumberOfGuess_ = this.currentNumberOfGuess_ + 1;
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

/**
 * get result
 * @param {function=} callback
 */
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

/**
 * submit result
 */
Hangman.prototype.submitResult = function () {
  this.sendRequest(this.generateSubmitResultRequest(this.gameContext_['sessionId']), function (err, response) {

  })
};

/**
 * send request
 * @param {Object} requestBody
 * @param {function=} callback
 */
Hangman.prototype.sendRequest = function (requestBody, callback) {
  var self = this;
  var requestStr = JSON.stringify(requestBody);
  var postOptions = {
    host: self.option_.host,
    path: self.option_.path,
    port: self.option_.port,
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
        if (!responseBody) {
          console.warn('empty response');
          console.trace();
          self.sendRequest(requestBody, callback); //retry
        } else {
          callback(null, responseBody);
        }
      }
    });

    res.on('error', function (e) {
      console.error(e);
    })
  });

  req.on('error', function (e) {
    if (e.code === 'ECONNRESET') {
      console.warn('drop timeout request.');
    }
    //else if(e.code === 'ETIMEDOUT'){
    //  req.abort();
    //  console.warn('request timeout, try again: ' + JSON.stringify(requestBody));
    //  self.sendRequest(requestBody, callback); //retry
    //}
    else {
      console.error(e);
    }
  });

  req.setTimeout(10000, function () {
    req.abort();
    console.warn('request timeout, try again: ' + JSON.stringify(requestBody));
    self.sendRequest(requestBody, callback); //retry
  });

  // post the data
  req.write(requestStr);
  req.end();
};

/**
 * get give me a word request
 * @param {string} sessionId
 * @return {{sessionId: string, action: string}}
 */
Hangman.prototype.generateGiveMeAWordRequest = function (sessionId) {
  return {
    'sessionId': sessionId,
    'action': 'nextWord'
  }
};

/**
 * get make a guess request
 * @param sessionId
 * @param guess
 * @return {{sessionId: string, action: string, guess: string}}
 */
Hangman.prototype.generateMakeAGuessRequest = function (sessionId, guess) {
  return {
    'sessionId': sessionId,
    'action': 'guessWord',
    'guess': guess
  }
};

/**
 * get start game request
 * @param {string} playerId
 * @return {{playerId: string, action: string}}
 */
Hangman.prototype.generateStartGameRequest = function (playerId) {
  return {
    'playerId': playerId,
    'action': 'startGame'
  };
};

/**
 * get get result request
 * @param {string} sessionId
 * @return {{sessionId: string, action: string}}
 */
Hangman.prototype.generateGetResultRequest = function (sessionId) {
  return {
    'sessionId': sessionId,
    'action': 'getResult'
  }
};

/**
 * get submit result request
 * @param {string} sessionId
 * @return {{sessionId: string, action: string}}
 */
Hangman.prototype.generateSubmitResultRequest = function (sessionId) {
  return {
    'sessionId': sessionId,
    'action': 'submitResult'
  }
};

/**
 * load all dictionary
 */
Hangman.prototype.loadAllDict = function () {
  var self = this;
  this.option_.dictList.forEach(function (name) {
    self.loadDict(name);
  })
};

/**
 * load dictionary to memory
 *
 * @param {string} name
 */
Hangman.prototype.loadDict = function (name) {
  var self = this;
  var dictArray = fs.readFileSync(path.join(self.option_.dictPath, name), {encoding: 'utf8'}).split('\n'); //todo
  var index = self.dict_.length;
  self.dict_[index] = [];
  dictArray.forEach(function (word) {
    if (!self.dict_[index][word.length]) {
      self.dict_[index][word.length] = [];
    }
    self.dict_[index][word.length].push(word);
  });
  console.log('dictionary loaded: ' + name);
};

/**
 * update dictionary to higher level
 */
Hangman.prototype.upgradeSubDict = function () {
  this.currentDictLevel_ += 1;
  console.log('upgrade dictionary level: ' + this.currentDictLevel_);
  this.buildSubDictOfLength(this.gameContext_['currentWord'].length);
  this.reduceCurrentSubDictByWord(this.gameContext_['currentWord']);
  this.reduceCurrentSubDictByChars(this.guessedChar_);
};

/**
 * check whether can update dictionary
 * @return {boolean}
 */
Hangman.prototype.canUpgradeDict = function () {
  return this.dict_.length > this.currentDictLevel_ + 1;
};

/**
 * build sub-dictionary of specific length
 * @param {number} length
 */
Hangman.prototype.buildSubDictOfLength = function (length) {
  if (!this.dict_[this.currentDictLevel_]) {
    this.dict_[this.currentDictLevel_][length] = [];
  }
  this.currentSubDict_ = this.dict_[this.currentDictLevel_][length].slice();
};

/**
 * reduce the sub-dictionary by remove all word that don't match current word's pattern
 * @param {string} toBeGuessed
 */
Hangman.prototype.reduceCurrentSubDictByWord = function (toBeGuessed) {
  var negatedSetReg = '[^';
  for (var i = 0; i < toBeGuessed.length; ++i) {
    if (negatedSetReg.indexOf(toBeGuessed[i]) === -1 && toBeGuessed[i] !== '*') {
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
    if (this.canUpgradeDict()) {
      this.upgradeSubDict();
    } else {
      this.passCurrent_ = true;
    }
  }
};

/**
 * reduce the sub-dictionary by remove all word that has specific characters
 * @param {Array.<string>} characters
 */
Hangman.prototype.reduceCurrentSubDictByChars = function (characters) {
  this.currentSubDict_ = this.currentSubDict_.filter(function (word) {
    for (var i = 0; i < characters.length; ++i) {
      if (word.indexOf(characters[i]) === -1) {
        continue
      } else {
        return false;
      }
    }
    return true;
  });
  if (this.currentSubDict_.length === 0) {
    console.warn('no candidate in dict: ' + this.gameContext_['currentWord']);
    if (this.canUpgradeDict()) {
      this.upgradeSubDict();
    } else {
      this.passCurrent_ = true;
    }
  }
};

/**
 * get most possible guess for the word
 * @param {string} tobeGuessed
 * @return {string}
 */
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

/**
 * get next guess
 * @return {string}
 */
Hangman.prototype.guess = function () {
  var curWord = this.gameContext_['currentWord'];
  var guess = this.getMostPossibleChar(curWord);
  return guess;
};

/**
 * check whether guess on current word is finished
 * @return {boolean}
 */
Hangman.prototype.guessFinish = function () {
  return this.gameContext_['currentWord'].indexOf('*') === -1
};

/**
 * check whether last guess is correct
 * @return {boolean}
 */
Hangman.prototype.guessWrong = function () {
  return this.gameContext_['currentWord'] === this.gameContext_['previousWord'];
};

/**
 * check whether game is finished
 * @return {boolean}
 */
Hangman.prototype.allFinished = function () {
  return this.gameContext_['totalWordCount'] === this.gameContext_['numberOfWordsToGuess'];
};

/**
 * check whether guess to current word is failed
 * @return {boolean}
 */
Hangman.prototype.failed = function () {
  return this.gameContext_['wrongGuessCountOfCurrentWord'] === this.gameContext_['numberOfGuessAllowedForEachWord'];
};

