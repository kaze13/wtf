require 'net/https'
require 'uri'
require 'json'
require 'logger'
require 'set'

class Hangman
  def initialize (option)
    @logger = Logger.new(STDOUT)
    @option = option
    @current_number_of_guess = 0
    @dict = []
    @current_dict_level = 0
    @current_sub_dict = []
    @guessed_char = []
  end

  def play
    load_all_dict
    start_game
  end

  private

  def next_round
    @guessed_char = []
    @current_dict_level = 0
    give_me_a_word
    build_sub_dict_of_len(@current_word.length)
    next_guess
  end

  def next_guess
    if @pass_current
      @pass_current = false
      next_round
    else
      guess = make_a_guess
      if guess_finished?
        if all_finished?
          get_result
        else
          next_round
        end
      elsif failed?
        get_result
        next_round
      elsif guess_wrong?
        @guessed_char << guess
        reduce_cur_sub_dict_by_chars([guess])
        next_guess
      else
        reduce_cur_sub_dict_by_word(@current_word)
        next_guess
      end
    end
  end

  def start_game
    res_obj = send_request(get_start_game_req(@option[:playerId]))
    @logger.info("Start game response: #{res_obj}")
    @session_id = res_obj['sessionId']
    @number_of_words_to_guess = res_obj['data']['numberOfWordsToGuess']
    @number_of_guess_allowed_for_each_word = res_obj['data']['numberOfGuessAllowedForEachWord']
    next_round
  end

  def give_me_a_word
    @current_number_of_guess = 0
    res_obj = send_request(get_give_me_a_word_req(@session_id))
    @logger.info("Give me a word response: #{res_obj}")
    @current_word = res_obj['data']['word']
    @total_word_count = res_obj['data']['totalWordCount']
    @wrong_guess_count_of_current_word = res_obj['data']['wrongGuessCountOfCurrentWord']
  end

  def make_a_guess
    next_guess = guess
    @logger.info("Next guess: #{next_guess}")
    @current_number_of_guess += 1
    res_obj = send_request(get_make_a_guess_req(@session_id, next_guess))
    @logger.info("Make a guess response: #{res_obj}")
    @previous_word = @current_word
    @current_word = res_obj['data']['word']
    @total_word_count = res_obj['data']['totalWordCount']
    @wrong_guess_count_of_current_word = res_obj['data']['wrongGuessCountOfCurrentWord']
    next_guess
  end

  def get_result
    res_obj = send_request(get_get_result_req(@session_id))
    @logger.info("Get result response: #{res_obj}")
    @correct_word_count = res_obj['data']['correctWordCount']
    @total_word_count = res_obj['data']['totalWordCount']
    @total_wrong_guess_count = res_obj['data']['totalWrongGuessCount']
    @score = res_obj['data']['score']
  end

  def submit_result
    send_request(get_submit_result_req(@session_id))
  end

  def send_request (request_body)
    uri = URI(@option[:host])
    req = Net::HTTP::Post.new(uri)
    req['Content-Type'] = 'application/json; charset=utf-8'
    req['Content-Length'] = request_body.length

    res = Net::HTTP.start(uri.hostname, uri.port, :use_ssl => uri.scheme == 'https') do |protocol|
      protocol.request(req, request_body.to_json)
    end

    case res
      when Net::HTTPSuccess
        return JSON.parse(res.body)
      else
        fail res.value
    end
    #timeout todo

  end

  def get_give_me_a_word_req(session_id)
    {:sessionId => session_id, :action => 'nextWord'}
  end

  def get_make_a_guess_req(session_id, guess)
    {:sessionId => session_id, :action => 'guessWord', :guess => guess}
  end

  def get_start_game_req(player_id)
    {:playerId => player_id, :action => 'start_game'}
  end

  def get_get_result_req(session_id)
    {:sessionId => session_id, :action => 'get_result'}
  end

  def get_submit_result_req(session_id)
    {:sessionId => session_id, :action => 'submit_result'}
  end

  def load_all_dict
    @option[:dictList].each {
        |name| load_dict(name)
    }
  end

  def load_dict(name)
    dict_index = @dict.length
    @dict[dict_index] = []
    File.open(File.join(@option[:dictPath], name)) do |file|
      file.each do |word|
        unless @dict[dict_index][word.length]
          @dict[dict_index][word.length] = []
        end
        @dict[dict_index][word.length] << word
      end
    end
    @logger.info("Dictionary loaded: #{name}")
  end

  def upgrade_sub_dict
    @current_dict_level += 1
    @logger.info("Dictionary upgraded to level: #{@current_dict_level}")
    build_sub_dict_of_len(@current_word.length)
    reduce_cur_sub_dict_by_word(@current_word)
    reduce_cur_sub_dict_by_chars(@guessed_char)
  end

  def can_upgrade_dict?
    @dict.length > @current_dict_level + 1
  end

  def build_sub_dict_of_len(length)
    unless @dict[@current_dict_level][length]
      @dict[@current_dict_level][length] = []
    end
    @current_sub_dict = @dict[@current_dict_level][length].clone
  end

  def reduce_cur_sub_dict_by_word(to_be_guessed)
    negated_set_reg = '[^'
    to_be_guessed.each_char do |char|
      negated_set_reg << char if (char != '*') && !negated_set_reg.include?(char)
    end
    negated_set_reg << ']'
    regex = to_be_guessed.gsub('*', negated_set_reg)
    @current_sub_dict.select! { |word| word.match(regex) }
    upgrade_dict_if_need
  end

  def reduce_cur_sub_dict_by_chars(characters)
    @current_sub_dict.select do |word|
      for i in 0..characters.length - 1
        next false if word.include?(characters[i])
      end
      next true
    end
    upgrade_dict_if_need
  end

  def upgrade_dict_if_need
    if @current_sub_dict.empty?
      @logger.warn("No candidate in dictionary: #{@current_word}")
      if can_upgrade_dict?
        upgrade_sub_dict
      else
        @pass_current = true
      end
    end
  end

  def get_most_possible_char (to_be_guessed)
    alpha_map = {'A' => 0}
    result = 'A'
    tmp = Set.new
    @current_sub_dict.each do |word|
      tmp.clear
      word.each_char do |char|
        tmp << char unless to_be_guessed.include?(char) || char == "\n"
      end
      tmp.each do |alpha|
        alpha_map[alpha] = alpha_map[alpha] ? alpha_map[alpha] + 1 : 1
        result = alpha if alpha_map[alpha] > alpha_map[result]
      end
    end
    result
  end

  def guess
    get_most_possible_char(@current_word)
  end

  def guess_finished?
    !@current_word.include?('*')
  end

  def guess_wrong?
    @current_word == @previous_word
  end

  def all_finished?
    @total_word_count == @number_of_words_to_guess
  end

  def failed?
    @wrong_guess_count_of_current_word == @number_of_guess_allowed_for_each_word
  end
end