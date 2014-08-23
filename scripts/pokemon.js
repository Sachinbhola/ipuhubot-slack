// Description:
//   Pokemon
//
// Commands:
//   hubot battle - do battle

var pokemon = require('../src/class/ipuhubot-pokemon')
var _ = require('underscore');
var async = require('async')
var cronJob = require('cron').CronJob
var printf = require('printf')

module.exports = function(robot) {
  // ランダムで出現させる
  new cronJob('0 0 5 * * *', function() {
    async.waterfall([
      // でかいぷいるか取得
      function(callback) {
        pokemon.appearedDekaIPU(function(val) {
          callback(null, val);
        });
      },
      // 判断
      function(val, callback) {
        if (val == 'true') {
          robot.messageRoom("#ipuhubot", "誰か相手してよ。。。");
          return;
        } else {
          setTimeout(function() {
            callback(null);
          }, 1000);
        }
      },
      // 出す
      function(callback) {
        pokemon.buildDekaIPU(function(hp) {
          setTimeout(function() {
            var message = printf("ずずずずずずず\nでかいぷが現れた！！HP: %s\n http://www.nintendo.co.jp/3ds/balj/img/top/main_kirby.png", hp);
            robot.messageRoom("#ipuhubot", message);
          }, 1000);
        });
      }
    ]);
  }).start();

  // NOTE: ここは hogheoge rank と merge させたい
  robot.respond(/pokemon\srank/i, function(msg) {
    pokemon.getDamageRank(function(err, body) {
      msg.send(body.key.replace(/hubot:dekaipu:damage:/, '') + ": " + body.damage)
    });
  });

  robot.respond(/pokemon\sbattle/i, function(msg) {
    async.waterfall([
      // ランダムで手持ちのポケモン選ぶ
      function(callback) {
        pokemon.appearedDekaIPU(function(val) {
          if(val == 'false') {
            msg.send("でかいぷ君が現れていないぞ！");
            return;
          }
          callback(null);
        });
      },
      function(callback) {
        pokemon.checkLastAttacker(function(attacker) {
          if(msg.message.user.name == attacker) {
            msg.send("二回連続攻撃はできないぞ！");
            return;
          } else if(attacker == 'false') {
            // 初回 50 point ボーナス
            bonus = 50;
            msg.send(printf("初回攻撃ボーナス %d ポイントだ！", bonus));
            pokemon.addBonusPoint(msg.message.user.name, bonus);
          }
          callback(null);
        });
      },
      function (callback) {
        pokemon.getPokemonRandom(function(err, pokemon_info) {
          msg.send(printf("%s！君にきめた！", pokemon_info.name));
          setTimeout(function() {
            pokemon.getPokemonImg(pokemon_info.name, function(err, img) {
              msg.send(img);
            });
            callback(null, pokemon_info.resource_uri);
          }, 1000);
        });
      },
      // 選んだポケモンを戦わせる
      function(uri, callback) {
        pokemon.getPokemonInfo(uri, function(err, info) {
          body = printf("攻撃力: %d\n", info.attack);
          msg.send(body);
          setTimeout(function() {
            callback(null, info);
          }, 1000);
        });
      },
      function (info, callback) {
        pokemon.doAttack(msg.message.user.name, info, function(err, damage, crit, hp) {
          if (crit) {
            msg.send("おっと！急所にあたった！");
          }
          msg.send(printf("%d のダメージ！", damage));
          if (hp < 0) {
            bonus = 100;
            msg.send(printf("やった！でかいぷ君を倒したぞ！ボーナスで %d ポイントだ！", bonus));
            pokemon.delDekaIPU();
            // 討伐ポイント 100
            pokemon.addBonusPoint(msg.message.user.name, bonus);
          } else {
            msg.send(printf("でかいぷ君にダメージを与えた！残りHPは %d だぞ！", hp));
          }
        });
      }
    ]);
  });

  // New Pokemon
  robot.respond(/pokemon\sparty$/i, function(msg) {
    user_name = msg.message.user.name;
    msg.send(user_name + " のパーティ");

    pokemon.getParty(user_name, function(err, party) {
      JSON.parse(party).forEach(function(mon) {
        pokemon.getPokemonImg(mon.name, function(err, img) {
          msg.send(printf("%s [LV: %s]\n", mon.name, mon.lv, img));
        });
      });
    });
  });

  // 最初のポケモンを手に入れられるやつ
  robot.respond(/pokemon\sokido$/i, function(msg) {
    key = 'okido';
    user_name = msg.message.user.name;

    async.waterfall([
      // 操作チェック
      function(callback) {
        pokemon.checkLock(key, function(err, lock) {
          if (lock != "false" && lock != null) {
            msg.send("おっと誰かが操作中のようじゃ");
            return;
          } else {
            pokemon.lock(key, user_name, function(err, result) {
              setTimeout(function() {
                callback(null);
              }, 1000);
            });
          }
        })
      },
      // チュートリアルチェック
      function(callback) {
        pokemon.getUserInfo(user_name, function(err, info) {
          if (info == null) {
            callback(null);
          } else if (info.tutorial == true) {
            msg.send("お前さんはすでにポケモンを手に入れているようじゃ");
            return;
          } else {
            callback(null);
          }
        });
      },
      // 選択中
      function(callback) {
        // ふしぎだね、ぜにがめ、ひとかげ
        firstPokemons = [1, 4, 7];
        msg.send(printf("%s 君よ、最初のポケモンはこいつらじゃ\n好きなポケモンの番号を選ぶのじゃ", user_name));
        firstPokemons.forEach(function(i) {
          url = printf("api/v1/pokemon/%s", i);
          pokemon.getPokemonInfo(url, function(err, mon) {
            pokemon.getPokemonImg(mon.name, function(err, img) {
              msg.send(printf("%s: %s\n%s", i, mon.name, img));
            });
          });
        });
        callback(null);
      },
    ])
  });

  robot.respond(/pokemon\sokido\sselect\s(.*)$/i, function(msg) {
    key = 'okido';
    user_name = msg.message.user.name;

    async.waterfall([
      // 操作チェック
      function(callback) {
        pokemon.checkLock(key, function(err, lock) {
          if (lock == null) {
            msg.send(printf("オーキドのことば......\n%s よ！ こういうものには つかいどきが あるのじゃ！", user_name));
            return;
          }
          lock_user_name = lock.replace(/hubot:pokemon:lock:okido/, '');
          if (lock_user_name != user_name) {
            msg.send("おっと誰かが操作中のようじゃ");
            return;
          } else {
            callback(null);
          }
        })
      },
      // 番号チェック
      function(callback) {
        select_num = Number(msg.match[1]);
        if ([1, 4, 7].indexOf(select_num) != -1) {
          pokemon.getPokemon(user_name, select_num, function(err, result, mon) {
            if (result == "success") {
              msg.send("やった！" + mon.name + " をゲットしたぞ！");
            }
            callback(null);
          });
        } else {
          msg.send("その番号は無効じゃ。。。ゲームオーバーじゃ!!!");
        }
      },
      function(callback) {
        pokemon.setTutorial(user_name, function(err, result) {
          callback(null);
        });
      },
      // 最後にロックを外す
      function(callback) {
        pokemon.unlock(key, function(err, result) {
          callback(null);
        });
      },
    ])
  });

}
