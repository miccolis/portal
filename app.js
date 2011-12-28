var path = require('path'),
    couchapp = require('couchapp'),
    _ = require('underscore');

ddoc = {
    _id:'_design/app',
    rewrites : [
        {from:"/", to:'index.html'},
        {from:"/api", to:'../../'},
        {
          from:"/api/packages",
          to:'../../_all_docs',
          query: {include_docs: 'true'}
        },
        {
          from:"/api/search/",
          to:'../../_design/app/_view/search',
          query: {reduce: 'false', limit: '10000'}
        },
        {
          from:"/api/facet/:facet",
          to:'../../_design/app/_view/:facet',
          query: {group: 'true'}
        },
        {
          from:"/api/filter/:facet/:key",
          to:'../../_design/app/_view/:facet',
          query: {reduce: 'false', include_docs: 'true'}
        },
        {from:"/api/session", to:'../../_session'},
        //{from:"/api/*", to:'../../*'},
        {from:"/*", to:'*'},
    ]
};

ddoc.views = {};
ddoc.views.lib = couchapp.loadFiles('./lib');
ddoc.views.authors = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.author) {
            if (doc.author.length) emit(doc.author, null);
        }
    },
    reduce: "_count"
};
ddoc.views.tags = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.tags) {
            doc.tags.forEach(function(d){
                emit(d, null);
            });
        }
    },
    reduce: "_count"
};
ddoc.views.formats = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.resources) {
            doc.resources.forEach(function(v) {
                if (v.format.length) {
                    if (v.format.match(/^[a-zA-z]{3,4}$/)) {
                        emit(v.format.toUpperCase(), null)
                    } else {
                        emit(v.format, null)
                    }
                }
            });
        }
    },
    reduce: "_count"
};
ddoc.views.licenses = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//) && doc.license) {
            if (doc.license.length) emit(doc.license, null);
        }
    },
    reduce: "_count"
};
ddoc.views.search = {
    map: function(doc) {
        if(doc._id.match(/^dataset\//)) {

            var stemmer = require('views/lib/porter').stemmer,
                stopwords = require('views/lib/stopwords').stopwords,
                text = [],
                stems = {};

            ['notes', 'title', 'author', 'tags'].forEach(function(attr) {
                // Bail if we've got no content.
                if (doc[attr] == undefined || doc[attr].length == 0) return;

                if (attr == 'tags') {
                    text.concat(doc[attr]);
                } else {
                    text.push(doc[attr]);
                }
            });

            text = text.join(' ');

            // Strip formatting out of numbers
            text = text.replace(/([0-9])(\.|\,)([0-9])/g, "$1$3");

            // Normalize text input. Currently only supports basic ASCII text.
            text = text.replace(/\W+/g, " ").toLowerCase();

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
            try {
                var t= ';;'
                t+= 'templates.'+ path.basename(f, '._') + '=';
                t+= _.template(data.toString('utf8'));
                return new Buffer(t);
            }
            catch(e) {
                console.log(e);
                console.log("ERROR: failed to transform template: "+f);
            }
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
