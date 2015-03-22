require 'net/https'
require 'uri'
require 'json'
require 'logger'

class Hangman
  def initialize (option)
    @logger = Logger.new(STDOUT)
    @option = option
    @currentNumberOfGuess = 0
    @dict = []
    @currentDictLevel = 0
    @currentSubDict = []
    @guessedChar = []
  end

  def play
    loadAllDict
    startGame
  end

  def nextRound
    @guessedChar = []
    @currentDictLevel = 0
    giveMeAWord
    buildSubDictOfLength(@currentWord.length)
    nextGuess
  end

  def nextGuess
    if (@passCurrent)
      @passCurrent = false
      nextRound
    else
      guess = makeAGuess
      if (guessFinished?)
        if (allFinished?)
          getResult
        else
          nextRound
        end
      elsif (failed?)
        getResult
        nextRound
      elsif (guessWrong?)
        @guessedChar << guess
        reduceCurrentSubDictByChars(guess)
        nextGuess
      else
        reduceCurrentSubDictByWord(@currentWord)
        nextGuess
      end
    end
  end

  def startGame
    resObj = sendRequest(generateStartGameRequest(@option[:playerId]))
    logger.info("Start game response: #{resObj}")
    @sessionId = resObj[:sessionId]
    @numberOfWordsToGuess = resObj[:data][:numberOfWordsToGuess]
    @numberOfGuessAllowedForEachWord = resObj[:data][:numberOfGuessAllowedForEachWord]
    nextRound
  end

  def giveMeAWord
    @currentNumberOfGuess = 0
    resObj = sendRequest(generateGiveMeAWordRequest(@sessionId))
    logger.info("Give me a word response: #{resObj}")
    @currentWord = resObj[:data][:word]
    @totalWordCount = resObj[:data][:totalWordCount]
    @wrongGuessCountOfCurrentWord = resObj[:data][:wrongGuessCountOfCurrentWord]
  end

  def makeAGuess
    nextGuess = guess
    logger.info("Next guess: #{nextGuess}")
    @currentNumberOfGuess += 1
    resObj = sendRequest(generateMakeAGuessRequest(@sessionId, nextGuess))
    logger.info("Make a guess response: #{resObj}")
    @previousWord = @currentWord
    @currentWord = resObj[:data][:word]
    @totalWordCount = resObj[:data][:totalWordCount]
    @wrongGuessCountOfCurrentWord = resObj[:data][:wrongGuessCountOfCurrentWord]
  end

  def getResult
    resObj = sendRequest(generateGetResultRequest(@sessionId))
    logger.info("Get result response: #{resObj}")
    @correntWordCount = resObj[:data][:correntWordCount]
    @totalWordCount = resObj[:data][:totalWordCount]
    @totalWrongGuessCount = resObj[:data][:totalWrongGuessCount]
    @score = resObj[:data][:score]
  end

  def submitResult
    sendRequest(generateSubmitResultRequest(@sessionId))
  end

  def sendRequest (requestBody)
    uri = URI('http://www.example.com/todo.cgi')
    req = Net::HTTP::Post.new(uri)
    req.set_form_data(requestBody)

    res = Net::HTTP.start(uri.hostname, uri.port, :use_ssl => uri.scheme == 'https') do |http|
      http.request(req)
    end

    case res
      when Net::HTTPSuccess
        return JSON.parse(res.body)
      else
        raise StandardError(res.value)
    end
    #timeout todo

  end

  def generateGiveMeAWordRequest(sessionId)
    return {
        :sessionId => sessionId,
        :action => 'nextWord'
    }

  end

  def generateMakeAGuessRequest(sessionId, guess)
    return {
        :sessionId => sessionId,
        :action => 'guessWord',
        :guess => guess
    }
  end

  def generateStartGameRequest(playerId)
    return {
        :playerId => playerId,
        :action => 'startGame'
    }
  end

  def generateGetResultRequest(sessionId)
    return {
        :sessionId => sessionId,
        :action => 'getResult'
    }
  end

  def generateSubmitResultRequest(sessionId)
    return {
        :sessionId => sessionId,
        :action => 'submitResult'
    }
  end

  def loadAllDict
    @option[:dictList].each {
        |name| loadDict(name)
    }
  end

  def loadDict(name)
    dictIndex = @dict.length
    @dict[dictIndex] = []
    File.open(File.join(@option[:dictPath], name)) do |file|
      file.each do |word|
        unless @dict[dictIndex][word.length]
          @dict[dictIndex][word.length] = []
        end
        @dict[dictIndex][word.length] << word
      end
    end
    logger.info("Dictionary loaded: #{name}")
  end

  def upgradeSubDict
    @currentDictLevel += 1
    logger.info("Dictionary upgraded to level: #{@currentDictLevel}")
    buildSubDictOfLength(@currentWord.length)
    reduceCurrentSubDictByWord(@currentWord)
    reduceCurrentSubDictByChars(@guessedChar)
  end

  def canUpgradeDict?
    @dict.length > @currentDictLevel + 1
  end

  def buildSubDictOfLength(length)
    if (!@dict[@currentDictLevel][length])
      @dict[@currentDictLevel][length] = []
    end
    @currentSubDict = @dict[@currentDictLevel][length].clone
  end

  def reduceCurrentSubDictByWord(toBeGuessed)
    negatedSetReg = '[^'
    toBeGuessed.each_char do |char|
      if negatedSetReg.include?(char) and (char != '*')
        negatedSetReg << char
      end
    end
    negatedSetReg << ']'
    regex = toBeGuessed.tr('*', negatedSetReg)
    @currentSubDict.select! { |word| word.match(regex) }
    upgradeDictIfNecessary
  end

  def reduceCurrentSubDictByChars(characters)
    @currentSubDict.select do |word|
      characters.each_char do |char|
        return false if word.include?(char)
      end
      return true
    end
    upgradeDictIfNecessary
  end

  def upgradeDictIfNecessary
    if @currentSubDict.empty?
      logger.warn("No candidate in dictionary: #{@currentWord}")
      if canUpgradeDict?
        upgradeSubDict
      else
        @passCurrent = true
      end
    end
  end

  def getMostPossibleChar
    alphaMap = {'A' => 0}
    result = 'A'
  end

  def guess

  end

  def guessFinished?

  end

  def guessWrong?

  end

  def allFinished?

  end

  def failed?

  end
end