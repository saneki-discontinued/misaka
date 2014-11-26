var https = require('https');

// Todo: derpibooru node package and use that
function DerpibooruModule() {
  this.info = {
    name: 'Derpibooru',
    command: { name: 'derpi', callback: DerpibooruModule.prototype.onDerpi.bind(this) },
    description: 'Provides commands for interacting with derpiboo.ru'
  };
}

DerpibooruModule.prototype.fetchImage = function(id, data, callback) {
  var module = this;

  var req = https.request({
    hostname: 'derpiboo.ru',
    path: '/images/' + id + '.json'
  }, function(res) {
    var str = '';
    res.on('data', function(chunk) {
      str += chunk;
    });
    res.on('end', function() {
      var obj = JSON.parse(str);
      if(callback) {
        callback(obj);
      }
    });
  });
  req.end();

  req.on('error', function(e) {
    console.warn('Error occurred while fetching derpibooru image ' + id + ':', e);
    //data.send('Error occurred while obtaining derpibooru image ' + id);
    if(callback) {
      callback();
    }
  });
};

DerpibooruModule.prototype.fetchRandom = function(data, callback) {
  var module = this;

  var req = https.request({
    hostname: 'derpiboo.ru',
    path: '/images/random.json'
  }, function(res) {
    var str = '';
    res.on('data', function(chunk) {
      str += chunk;
    });
    res.on('end', function() {
      var obj = JSON.parse(str);
      module.fetchImage(obj.id, data, callback);
    });
  });
  req.end();

  req.on('error', function(e) {
    console.warn('Error occurred while getting random derpibooru image');
    //data.send('Something weird happened while getting a derpibooru image, sorry!');
    if(callback) {
      callback();
    }
  });
};

DerpibooruModule.prototype.fixQuery = function(query) {
  query = query.replace('+', ''); // Remove +s

  var tags = query.split(',');
  for(var i = 0; i < tags.length; i++) {
    tags[i] = tags[i].split(/\s+/).join('+'); // Replace whitespace with +
  }

  query = tags.join(',');
  query = query.replace(/,,+/, ',');
  return query;
};

DerpibooruModule.prototype.fetchRandomWithQuery = function(query, callback) {
  var module = this;

  if(query === '') query = 'safe'; // Default
  query = '&q=' + this.fixQuery(query);

  var req = https.request({
    hostname: 'derpiboo.ru',
    path: '/search.json?sf=random' + query
  }, function(res) {
    var str = '';
    res.on('data', function(chunk) {
      str += chunk;
    });
    res.on('end', function() {
      var obj = JSON.parse(str);

      if(obj && obj.search && obj.search.length > 0) {
        if(callback) {
          callback(obj.search[0]);
        }
      } else {
        if(callback) {
          callback();
        }
      }
    });
  });
  req.end();

  req.on('error', function(err) {
    //console.warn('Error getting derpiboo.ru image:', err);
    //data.send('Couldn\'t get random derpiboo.ru image, sorry!');
    if(callback) {
      callback();
    }
  });
};

DerpibooruModule.prototype.getPrefix = function(tags) {
  var prefix = '';
  // A bit lazy
  if(tags.indexOf('suggestive') >= 0) {
    prefix += '(Suggestive) ';
  }
  if(tags.indexOf('explicit') >= 0) {
    prefix += '(Explicit) ';
  }
  if(tags.indexOf('questionable') >= 0) {
    prefix += '(Questionable) ';
  }
  if(tags.indexOf('grimdark') >= 0) {
    prefix += '(Grimdark) ';
  }

  return prefix;
};

DerpibooruModule.prototype.onDerpi = function(data) {
  var module = this;

  var query = data.parsed.tail || '';
  this.fetchRandomWithQuery(query, function(obj) {
    if(!obj) {
      data.send('Something weird happened while getting a derpibooru image, sorry!');
      return;
    }

    var tags = obj.tag_ids;
    var prefix = module.getPrefix(tags);
    var link = 'https://derpiboo.ru/images/' + obj.id_number;

    data.send(prefix + link);
  });
};

module.exports = DerpibooruModule;