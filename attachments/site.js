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

// Determine the name of the CouchDB we're working with.
var rootPath = /(.+)_design/.exec(location.pathname);
if (rootPath.length < 2) {
    console.error("Couldn't determine database name");
}
rootPath = rootPath[1];

// Begin Backbone setup.
var models = {};

models.Package = Backbone.Model.extend({
    url: function() {
        return rootPath + encodeURIComponent('dataset/' + this.id);
    },
    renderer: function() {
        var model = this;
        return {
          // Print
          p: function(attr) { return model.escape(attr); },
          // Raw
          r: function(attr) { return model.get(attr); },
          // Label
          l: function(attr) { return attr; },
          // Description
          d: function(attr) { return model.schema.properties[attr].description; }
        };
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
                required: 'true',
                format: 'text'
            },
            'author_email': {
                type: 'string',
                description: 'email for original creator of the dataset',
                required: 'true',
                format: 'email'
            },
            'maintainer': {
                type: 'string',
                description: 'current maintainer or publisher of the dataset',
                required: 'true',
                format: 'text'
            },
            'maintainer_email': {
                type: 'string',
                description: 'email for current maintainer or publisher of the dataset',
                required: 'true',
                format: 'email'
            },
            'license': {
                type: 'string',
                description: 'license under which the dataset is made available',
                required: 'true',
                format: 'text'
            },
            'version': {
                type: 'string',
                description: 'dataset version',
                required: 'true',
                format: 'text'
            },
            'notes': {
                type: 'string',
                description: 'description and other information about the dataset',
                required: 'true',
                format: 'text'
            },
            'tags': { 
                type: 'string',
                description: 'arbitrary textual tags for the dataset',
                required: 'true'
            },
            'resources': {
                type: 'string',
                description: 'list of Resources',
                required: 'true'
            },
            'groups': {
                type: 'string',
                description: 'list of Groups this dataset is a member of',
                required: 'true'
            }
        }
    }
});

models.Packages = Backbone.Collection.extend({
    model: models.Package,
    url: rootPath + '_all_docs?include_docs=true',
    parse: function(resp) {
        return _(resp.rows).pluck('doc');
    },
    initialize: function(models, options) {
        var options = options || {};
        if (options.filter && options.value) {
            var filters = ['tag', 'author', 'format', 'license'];
            var pos = filters.indexOf(options.filter);
            if (pos === -1) return; // TODO Fail harder.

            var url = rootPath +'_design/app/_view/facet_' + filters[pos] +'?';
            url += [
                'reduce=false',
                'include_docs=true',
                'key="'+ encodeURIComponent(options.value)+'"'
            ].join('&');
            this.url = url;
        }
    }
});

models.Resource = Backbone.Model.extend({
    url: function() {
        return rootPath + this.id;
    },
    schema: {
        name: 'package',
        properties: {
            url: {
                type: 'string',
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

models.Facet = Backbone.Model.extend({
    url: function() {
        return rootPath + '_design/app/_view/facet_' + encodeURIComponent(this.id) +'?group=true';
    }
})

var views = {};

views.Facets = Backbone.View.extend({
    initialize: function() {
        _.bindAll(this, 'render');
        var view = this;
        this.model.bind('all', function() { view.render(); });
    },
    render: function() {
        $('div.loading', this.el)
            .removeClass('loading')
            .empty()
            .html(templates.facets({
                id: this.model.id,
                rows: this.model.get('rows')
            }));

        return this;
    }
});

views.Home = Backbone.View.extend({
    render: function() {
        $(this.el).empty().html(templates.home());
        _(this.options.facets).each(function(v, i) {
            new views.Facets({
              el: $('.facets-teaser .facet-' + i),
              model: v
            });
        });
        return this;
    }
});

views.Package = Backbone.View.extend({
    initialize: function() {
        _.bindAll(this, 'render');
        var view = this;
        this.model.bind('all', function() { view.render(); });
    },
    render: function() {
        $(this.el).empty().html(templates.package(this.model.renderer()));
        return this;
    }
});

views.Catalog = Backbone.View.extend({
    initialize: function() {
        _.bindAll(this, 'render');
        var view = this;
        this.collection.bind('all', function() { view.render(); });
    },
    render: function() {
        var items = this.collection.map(function(m) {
            return m.renderer();
        });
        $(this.el).empty().html(templates.packages({packages: items}));
        return this;
    }
});

var App = Backbone.Router.extend({
    routes: {
        '': 'home',
        'search': 'search',
        'filter/:filter/:value': 'filter',
        'package/:id': 'package'
    },
    home: function() {
        var facets = {};
        ['publisher', 'tag', 'format', 'license'].forEach(function(att) {
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
        new views.Catalog({
            el: $('#main'),
            collection: collection
        });
        collection.fetch();
    },
    search: function() {
        var collection = new models.Packages();
        new views.Catalog({
            el: $('#main'),
            collection: collection 
        });
        collection.fetch();
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
