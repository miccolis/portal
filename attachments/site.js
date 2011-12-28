var request = function (options, callback) {
  options.success = function (obj) {
    callback(null, obj);
  }
  options.error = function (err) {
    if (err) callback(err);
    else callback(true);
  }
  if (options.data && typeof options.data == 'object') {
    options.data = JSON.stringify(options.data)
  }
  if (!options.dataType) options.processData = false;
  if (!options.dataType) options.contentType = 'application/json';
  if (!options.dataType) options.dataType = 'json';
  $.ajax(options)
}

$.expr[":"].exactly = function(obj, index, meta, stack){ 
  return ($(obj).text() == meta[3])
}

var param = function( a ) {
  // Query param builder from jQuery, had to copy out to remove conversion of spaces to +
  // This is important when converting datastructures to querystrings to send to CouchDB.
  var s = [];
  if ( jQuery.isArray(a) || a.jquery ) {
          jQuery.each( a, function() { add( this.name, this.value ); });		
  } else { 
    for ( var prefix in a ) { buildParams( prefix, a[prefix] ); }
  }
  return s.join("&");
	function buildParams( prefix, obj ) {
		if ( jQuery.isArray(obj) ) {
			jQuery.each( obj, function( i, v ) {
				if (  /\[\]$/.test( prefix ) ) { add( prefix, v );
				} else { buildParams( prefix + "[" + ( typeof v === "object" || jQuery.isArray(v) ? i : "") +"]", v )}
			});				
		} else if (  obj != null && typeof obj === "object" ) {
			jQuery.each( obj, function( k, v ) { buildParams( prefix + "[" + k + "]", v ); });				
		} else { add( prefix, obj ); }
	}
	function add( key, value ) {
		value = jQuery.isFunction(value) ? value() : value;
		s[ s.length ] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
	}
}

var rootPath = location.pathname;

// Begin Backbone setup.
var models = {};

// This Object should not be used directly. It is meant to be extended by
// those looking for a model that knows something about schemas.
models.Schema = Backbone.Model.extend({
    schema: { properties: {}},
    renderer: function() {
        var model = this,
            props = this.schema.properties;

        return {
          // Print
          p: function(attr) {
              if (props[attr] != undefined) {
                  var e = model.escape(attr);
                  if (props[attr].format == 'uri') {
                      return '<a href="'+ e +'">'+ e +'</a>';
                  }
                  return e;
              }
          },
          // Raw
          r: function(attr) { return model.get(attr); },
          // Label
          l: function(attr) { return attr; },
          // Description
          d: function(attr) { return model.schema.properties[attr].description; }
        };
    }
});

models.Package = models.Schema.extend({
    url: function() {
        return rootPath + '/api/' + encodeURIComponent('dataset/' + this.id);
    },
    parse: function(resp) {
        if (resp.resources.length) {
            resp.resources = new models.Resources(resp.resources);
        }
        _(['tags', 'groups']).each(function(i) {
            resp[i] = new models.Tags(_(resp[i]).map(function(v) {
                return {name: v};
            }));
        });
        return resp;
    },
    schema: {
        name: 'package',
        properties: {
            'id': {
                type: 'string',
                description: 'unique id',
                required: 'true'
            },
            'name': {
                type: 'string',
                description: 'unique name that is used in urls and for identification',
                required: 'true'
            },
            'title': {
                type: 'string',
                description: 'short title for dataset',
                required: 'true',
                format: 'text'
            },
            'url': {
                type: 'string',
                description: 'home page for this dataset',
                required: 'true',
                format: 'uri'
            },
            'author': {
                type: 'string',
                description: 'original creator of the dataset',
                required: 'false',
                format: 'text'
            },
            'author_email': {
                type: 'string',
                description: 'email for original creator of the dataset',
                required: 'false',
                format: 'email'
            },
            'maintainer': {
                type: 'string',
                description: 'current maintainer or publisher of the dataset',
                required: 'false',
                format: 'text'
            },
            'maintainer_email': {
                type: 'string',
                description: 'email for current maintainer or publisher of the dataset',
                required: 'false',
                format: 'email'
            },
            'license': {
                type: 'string',
                description: 'license under which the dataset is made available',
                required: 'false',
                format: 'text'
            },
            'version': {
                type: 'string',
                description: 'dataset version',
                required: 'false',
                format: 'text'
            },
            'notes': {
                type: 'string',
                description: 'description and other information about the dataset',
                required: 'false',
                format: 'text'
            },
            'tags': { 
                type: 'array',
                description: 'arbitrary textual tags for the dataset',
            },
            'resources': {
                type: 'string',
                description: 'list of Resources',
                required: 'false'
            },
            'groups': {
                type: 'array',
                description: 'list of Groups this dataset is a member of',
            },
            'extras': {
                type: 'object',
            }
        }
    }
});

models.Packages = Backbone.Collection.extend({
    model: models.Package,
    url: rootPath + '/api/packages',
    parse: function(resp) {
        return _(resp.rows).pluck('doc');
    },
    initialize: function(models, options) {
        var options = options || {};
        if (options.filter && options.value) {
            var filters = ['tags', 'authors', 'formats', 'licenses'];
            var pos = filters.indexOf(options.filter);
            if (pos === -1) return; // TODO Fail harder.

            this.url = rootPath +'/api/filter/' + filters[pos] +'/';
            this.url += encodeURIComponent(options.value);
            this.options = options;
        }
    }
});

models.Tags = Backbone.Collection.extend({model: Backbone.Model});

models.Resource = models.Schema.extend({
    initialize: function() {
      _.bindAll(this, 'renderer');
    },
    url: function() {
        return rootPath + this.id;
    },
    schema: {
        name: 'package',
        properties: {
            url: {
                type: 'string',
                format: 'uri',
                description: 'The url points to the location online where the content of that resource can be found. For a file this would be the location online of that file (or more generally a url which yields the bitstream representing the contents of that file. For an API this would be the endpoint for the api.',
                required: 'true'
            },
            name: {
                type: 'string',
                description: 'a name for this resource (could be used in a ckan url)'
            },
            description: {
                type: 'string',
                description: 'A brief description (one sentence) of the Resource. Longer descriptions can go in notes field of the associated Data Package.',
            },
            type: {
                type: 'string',
                description: 'the type of the resource. One of: file | api | service | listing'
            },
            file: {
                description: '- a file (GET of this url should yield a bitstream)\n api - an API\nservice (?) - an online service such as google docs\nlisting (?) - a listing or index resource (a page listing of other resources). It is common, at present, to find projects where the data is in lots of files with these files listed on an index page. Rather than attempt to create a resource entry for each file we have adopted the convention of creating a resource for the relevant listing page.'
            },
            format: {
                description: 'human created format string with possible nesting e.g. zip:csv. See below for details of the format field.'
            },
            mimetype: {
                description: 'standard mimetype (e.g. for zipped csv would be application/zip)'
            },
            mimetype_inner: {
                description: 'mimetype of innermost object (so for example would be text/csv)'
            },
            size: {
                description: 'size of the resource (content length). Usually only relevant for resources of type file.'
            },
            last_modified: {
                description: 'the date when this resource\'s data was last modified (NB: not the date when the metadata was modified).'
            },
            hash: {
                description: 'md5 or sha-1 hash'
            }
        }
    }
});

models.Resources = Backbone.Collection.extend({model: models.Resource});

models.Facet = Backbone.Model.extend({
    url: function() {
        return rootPath + '/api/facet/' + encodeURIComponent(this.id) +'?group=true';
    }
});

models.Search = Backbone.Model.extend({
    url: function() {
        return rootPath + '/api/search';
    },
    sync: function(method, model, options) {
        if (method != 'read') return options.error('Unsupported method');

        var text = model.get('keywords'),
            data = [];

        // Strip formatting out of numbers
        text = text.replace(/([0-9])(\.|\,)([0-9])/g, "$1$3");

        // Normalize text input. Currently only supports basic ASCII text.
        text = text.replace(/\W+/g, " ").toLowerCase();

        // Remove stopwords and stem.
        text.split(' ').forEach(function(word) {
            if (word.length && portalSearch.stopwords[word] == undefined){
                data.push(portalSearch.stemmer(word));
            }
        });

        $.ajax({
            url: model.url(),
            type: "POST",
            data: JSON.stringify({keys: data}),
            processData: false,
            contentType: 'application/json',
            dataType: 'json',
            error: options.error,
            success: function(resp) {

                var ids = _(resp.rows).chain()
                    .groupBy(function(v){return v.id;})
                    .map(function(v, k){ return {id: k, count: v.length};})
                    .sortBy(function(v) { return v.count; })
                    .first(100)
                    .pluck('id')
                    .value();

                $.ajax({
                    url: rootPath + '/api/packages',
                    type: "POST",
                    data: JSON.stringify({keys: ids}),
                    processData: false,
                    contentType: 'application/json',
                    dataType: 'json',
                    error: options.error,
                    success: options.success
                });
            }
        });

    },
    parse: function(resp) {
        return {results: new models.Packages(_(resp.rows).pluck('doc'))};
    }
});

var views = {};

views.Facets = Backbone.View.extend({
    initialize: function() {
        _.bindAll(this, 'render');
        var view = this;
        this.model.bind('all', function() { view.render(); });
    },
    render: function() {
        var path = 'filter/' + encodeURIComponent(this.model.id);
        var rows = _(this.model.get('rows')).map(function(v) {
            return {
                name: v.key, // TODO escape
                count: v.value,
                path:  path + '/' + encodeURIComponent(v.key)
            };
        });
        $('div.loading', this.el)
            .removeClass('loading')
            .empty()
            .html(templates.facets({
                id: this.model.escape('id'),
                rows: rows
            }));

        return this;
    }
});

views.Home = Backbone.View.extend({
    events: {
        'click .search input.button': 'search',
        'keydown .search input.text-input': 'searchKeypress'
    },
    render: function() {
        $(this.el).empty().html(templates.search() + templates.home());
        _(this.options.facets).each(function(v, i) {
            new views.Facets({
              el: $('.facets-teaser .facet-' + i),
              model: v
            });
        });
        return this;
    },
    search: function() {
        var keywords = $('.search input.text-input', this.el).val();
        if (keywords.length) {
          location.hash = '#search/' + encodeURIComponent(keywords);
        }
    },
    searchKeypress: function(ev) {
        if (ev.keyCode == 13) {
            this.search();
        }
    }
});

views.Package = Backbone.View.extend({
    initialize: function() {
        _.bindAll(this, 'render');
        var view = this;
        this.model.bind('change', function() { view.render(); });
    },
    render: function() {
        var model = this.model,
            context = this.model.renderer();

        _(['resources', 'tags', 'groups']).each(function(i) {
            context[i] = [];
            var attr = model.get(i);
            if (attr) {
                attr.each(function(v) {
                    if (i == 'resources') {
                        context[i].push(v.renderer());
                    }
                    else {
                        context[i].push(v.escape('name'));
                    }
                });
            }
        });

        $(this.el).empty().html(templates.package(context));
        return this;
    }
});

views.Filter = Backbone.View.extend({
    initialize: function() {
        _.bindAll(this, 'render', 'renderCollection');
        var view = this;
        this.collection.bind('all', function() { view.renderCollection(); });
    },
    render: function() {
        var o = this.options;
        $(this.el).empty().html(templates.filterPage({title: o.filter +': '+ o.value}));
    },
    renderCollection: function() {
        var items = this.collection.map(function(m) {
            return m.renderer();
        });
        $('.packages', this.el).empty().html(templates.packages({packages: items}));
        return this;
    }
});

views.Search = Backbone.View.extend({
    // TODO unify with other search code.
    events: {
        'click .search input.button': 'search',
        'keydown .search input.text-input': 'searchKeypress'
    },
    initialize: function() {
        _.bindAll(this, 'render');
        var view = this;
        this.model.bind('all', function() { view.render(); });
    },
    render: function() {
        $(this.el).empty().html(templates.search());
        $('.search input.text-input', this.el).val(this.model.escape('keywords'));

        var results = this.model.get('results');
        if (results) {
            var items = results.map(function(m) {
                var context = m.renderer();
                context.resourceCount = m.get('resources').length;
                return context;
            });
            $(this.el).append(templates.packages({packages: items}));
        }
        return this;
    },
    search: function() {
        var keywords = $('.search input.text-input', this.el).val();
        if (keywords.length) {
          location.hash = '#search/' + encodeURIComponent(keywords);
        }
    },
    searchKeypress: function(ev) {
        if (ev.keyCode == 13) {
            this.search();
        }
    }
});

var App = Backbone.Router.extend({
    routes: {
        '': 'home',
        'search/:keywords': 'search',
        'filter/:filter/:value': 'filter',
        'package/:id': 'package'
    },
    home: function() {
        var facets = {};
        ['authors', 'tags', 'formats', 'licenses'].forEach(function(att) {
            facets[att] = new models.Facet({id: att});
        });
        new views.Home({
            el: $('#main'),
            facets: facets
        }).render();
        _(facets).each(function(m) { m.fetch(); });
    },
    filter: function(filter, value) {
        var collection = new models.Packages(null, {filter: filter, value: value});
        new views.Filter({
            el: $('#main'),
            collection: collection,
            filter: filter,
            value: value
        }).render();
        collection.fetch();
    },
    search: function(keywords) {
        var model = new models.Search({keywords: keywords});
        new views.Search({ el: $('#main'), model: model });
        model.fetch();
    },
    package: function(id) {
        var model = new models.Package({id:id});
        new views.Package({
            el: $('#main'),
            model: model
        });
        model.fetch();
    },
});

$(function () { 
    new App();
    Backbone.history.start({
        root: location.pathname
    });
});
