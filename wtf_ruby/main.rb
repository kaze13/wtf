require './hangman'
hangman = Hangman.new({
                          :host => 'https://strikingly-hangman.herokuapp.com/game/on',
                          :path => '/game/on',
                          :port => 443,
                          :playerId => 'cml_hawke0@163.com',
                          :dictPath => './dict',
                          :dictList => %w(small large huge)
                      })
hangman.play