// Description:
//   Pokemon

var async = require('async');
var request = require('request');
var printf = require('printf');
var _ = require('underscore');
var client = require('redis').createClient()

var Pokemon = function() {
  this.api = 'http://pokeapi.co';
}

// でかいぷがいるか
Pokemon.prototype.appearedDekaIPU =  function(callback) {
  client.get('hubot:dekaipu:appeared', function(err, val) {
      callback(val);
  });
}

// ボーナスポイント
Pokemon.prototype.addBonusPoint = function(user_name, point) {
  damage_key = printf("hubot:dekaipu:damage:%s", user_name);
  client.get(damage_key, function(err, val2) {
    client.set(damage_key, Number(val2) + point)
  });
}

// でかいぷだす
Pokemon.prototype.buildDekaIPU = function(callback) {
  dekaipu_hp = 500;
  client.set('hubot:dekaipu:hp', dekaipu_hp);
  client.set('hubot:dekaipu:appeared', 'true');
  client.set('hubot:dekaipu:last_attacker', 'false');
  callback(dekaipu_hp);
}

// 最後の攻撃者を確認
Pokemon.prototype.checkLastAttacker = function(callback) {
  client.get('hubot:dekaipu:last_attacker', function(err, val) {
    callback(val);
  });
}

// でかいぷ消す
Pokemon.prototype.delDekaIPU = function(callback) {
  client.set('hubot:dekaipu:appeared', 'false');
}

// 攻撃する
Pokemon.prototype.doAttack = function(user_name, pokemon, callback) {
  client.get('hubot:dekaipu:hp', function(err, hp) {
    seed = Math.random();
    damage = Math.floor(0.8 * pokemon.attack + seed * 0.4 * pokemon.attack);
    crit = false;
    if (Math.random() > 0.9) {
      crit = true;
      damage = damage * 2;
    }
    dekaipu_hp = Number(hp) - damage;
    client.set('hubot:dekaipu:hp', dekaipu_hp);
    client.set('hubot:dekaipu:last_attacker', user_name);
    damage_key = printf("hubot:dekaipu:damage:%s", user_name);
    client.get(damage_key, function(err, val2) {
      client.set(damage_key, Number(val2) + damage);
    });
    callback(err, damage, crit, dekaipu_hp);
  });
}

// ダメージランキング表示
Pokemon.prototype.getDamageRank = function(callback) {
  client.keys("hubot:dekaipu:damage:*", function(err, keys) {
    _.each(keys, function(key) {
      client.get(key, function(err2, damage) {
        var obj = {key: key, damage:damage};
        callback(null, obj);
      });
    });
  });
}

// ポケモン情報取得
Pokemon.prototype.getPokemonInfo = function(uri, callback) {
  url = printf("http://pokeapi.co/%s", uri);
  request.get(url, function(err, res, body) {
    callback(err, JSON.parse(body));
  });
}

// ランダムにポケモンを選ぶ
Pokemon.prototype.getPokemonRandom = function(callback) {
  url = printf("%s/api/v1/pokedex/", this.api);
  request.get(url, function(err, res, body) {
    pokemon = _.sample(JSON.parse(body).objects[0].pokemon);
    callback(err, pokemon);
  });
}

// ポケモン画像
Pokemon.prototype.getPokemonImg = function(name, callback) {
  img_api = printf("http://ajax.googleapis.com/ajax/services/search/images?q=%s&v=1.0", name);
  request.get(img_api, function(err, res, body) {
    img_url = JSON.parse(body).responseData.results[0].unescapedUrl;
    callback(err, img_url);
  });
}

// message lock
Pokemon.prototype.checkLock = function(key, callback) {
  client.get(printf('hubot:pokemon:lock:%s', key), function(err, lock) {
    callback(null, lock);
  });
}

Pokemon.prototype.lock = function(key, user_name, callback) {
  client.set(printf('hubot:pokemon:lock:%s', key), user_name);
  callback(null, true);
}

Pokemon.prototype.unlock = function(key, callback) {
  client.set(printf('hubot:pokemon:lock:%s', key), false);
  callback(null, true);
}

Pokemon.prototype.getUserInfo = function(user_name, callback) {
  client.get(printf('hubot:pokemon:user:%s', user_name), function(err, body) {
    user_info = JSON.parse(body);
    callback(null, user_info);
  });
}

Pokemon.prototype.setTutorial = function(user_name, callback) {
  user_info = {
    'tutorial': true
  };
  client.set(printf('hubot:pokemon:user:%s', user_name), JSON.stringify(user_info));
  callback(null, user_info);
}

Pokemon.prototype.getParty = function(user_name, callback) {
  client.get(printf('hubot:pokemon:party:%s', user_name), function(err, party) {
    callback(null, party);
  });
}

Pokemon.prototype.getMyPokemon = function(user_name, callback) {
  client.get(printf('hubot:pokemon:party:%s', user_name), function(err, party) {
    callback(null, _.first(JSON.parse(party), 1)[0]);
  });
}


Pokemon.prototype.getPokemon = function(user_name, num, callback) {
  url = printf("http://pokeapi.co/api/v1/pokemon/%s", num);
  request.get(url, function(err, res, mon) {
    mon_obj = JSON.parse(mon);
    pokemon = {
      "name": mon_obj.name,
      "resource_uri": mon_obj.resource_uri,
      "lv": 1,
      "status": {
        "hp": mon_obj.hp,
        "attack": mon_obj.attack,
        "defense": mon_obj.defense,
        "sp_atk": mon_obj.sp_atk,
        "sp_def": mon_obj.sp_def,
        "speed": mon_obj.speed,
      }
    }
    client.get(printf('hubot:pokemon:party:%s', user_name), function(err, party) {
      party_obj = JSON.parse(party);
      var new_party = null;
      if (party == null) {
        new_party = new Array(pokemon);
      } else {
        new_party = party_obj.concat(pokemon);
      }
      client.set(printf('hubot:pokemon:party:%s', user_name), JSON.stringify(new_party));
      callback(null, 'success', pokemon);
    });
  });
}

module.exports = new Pokemon
