var path = require('path'),
    couchapp = require('couchapp'),
    _ = require('underscore');

ddoc = 
  { _id:'_design/app'
  , rewrites : 
    [ {from:"/", to:'index.html'}
    , {from:"/api", to:'../../'}
    , {from:"/api/*", to:'../../*'}
    , {from:"/*", to:'*'}
    ]
  }
  ;

ddoc.views = {};
ddoc.views.lib = couchapp.loadFiles('./lib');
ddoc.views.facet_publisher = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.author) {
            emit(doc.author, null);
        }
    },
    reduce: "_count"
};
ddoc.views.facet_tag = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.tags) {
            doc.tags.forEach(function(d){
                emit(d, null);
            });
        }
    },
    reduce: "_count"
};
ddoc.views.facet_format = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.resources) {
            doc.resources.forEach(function(v) {
                emit(v.format, null)
            });
        }
    },
    reduce: "_count"
};
ddoc.views.facet_license = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.license) {
            emit(doc.license, null);
        }
    },
    reduce: "_count"
};
ddoc.views.search = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.notes) {
            var stemmer = require('views/lib/porter').stemmer,
                stopwords = require('views/lib/stopwords').stopwords,
                stems = {};

            // Normalize the input. Currently only supports basic ASCII text.
            text = doc.notes.replace(/\W+/g, " ").toLowerCase();

            // Remove stopwords and stem.
            text.split(' ').forEach(function(word) {
                if (word.length && stopwords[word] == undefined){
                    word = stemmer(word);
                    if (stems[word] == undefined) {
                        stems[word] = 1;
                    } else {
                        stems[word]++;
                    }
                }
            });

            for (var word in stems) {
                emit(word, stems[word]);
            }
        }
    },
    reduce: "_sum"
};



ddoc.validate_doc_update = function (newDoc, oldDoc, userCtx) {   
  if (newDoc._deleted === true && userCtx.roles.indexOf('_admin') === -1) {
    throw "Only admin can delete documents on this database.";
  } 
}

// Load normal attachments.
couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

// Load templates as a single attachment.
couchapp.loadAttachments(ddoc, path.join(__dirname, 'templates'), {
  operators: [function(f, data) {
      if (path.extname(f) === '._') {
          var t= ';;'
          t+= 'templates.'+ path.basename(f, '._') + '=';
          t+= _.template(data.toString('utf8'));
          return new Buffer(t); 
      }
      return data; 
  }],
  aggregator: function(files) {
      var templates = 'var templates = templates || {};\n',
          aggregated = [];
      files.forEach(function(f) {
          templates += f.data.toString('utf8');
      });
      aggregated.push({data: new Buffer(templates), name: 'templates.js', mime: 'text/javascript'});
      return aggregated;
  }
});

// Load search libraries
couchapp.loadAttachments(ddoc, path.join(__dirname, 'lib'), {
    aggregator: function(files) {
        var code = ';var portalSearch = {}; (function() { var exports = portalSearch;';
        files.forEach(function(f) {
            code += f.data.toString('utf8');
        });
        code += ';})();';
        return [{data: new Buffer(code), name: 'search.js', mime: 'text/javascript'}];
    }
});

module.exports = ddoc;
