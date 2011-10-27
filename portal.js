#!/usr/bin/env node

var path = require('path'),
    fs = require('fs'),
    request = require('request'),
    exec = require('child_process').exec;

var node = process.argv.shift(),
    bin = process.argv.shift(),
    command = process.argv.shift(),
    couch = process.argv.shift();

if (command == 'help' || command == undefined) {
    console.log(
      [ "portal.js -- loader utility for Portal application." 
      , ""
      , "Usage:"
      , "  portal.js <command> http://localhost:5984/dbname"
      , ""
      , "Commands:"
      , "  push   : Push app once to server."
      , "  import: Import testing data."
      ]
      .join('\n')
    );
    process.exit();
}

// Beyond this point we need to have a node binary and a couch uri.
if (node === undefined || couch === undefined) {
    console.error('Error: missing required argument.');
    process.exit();
}

/**
 * This "push" command exists primarily do avoid the normal situation with
 * couchapps where you need to have the couchapp packaged installed twice
 * in order for it to work.
 */
if (command == 'push') {
    var couchapp = path.dirname(require.resolve('couchapp'));
    couchapp = path.join(couchapp, 'bin.js');
    path.exists(couchapp, function(exists) {
        if (!exists) return console.error('Error: Could not locate couchapp.');
        // TODO use a full path for 'app.js'
        exec([node, couchapp, 'push app.js',couch].join(' '), function(error, stdout, stderr) {
            if(error) return console.error(error);
            console.log(stdout);
        });
    });
}

/**
 * Import data into CouchDB. This command expects `.json` files in a `data`
 * directory. Try http://catalogue.data.gov.uk/dump/
 */
if (command == 'import') {
    var dir = path.join(__dirname, 'data');
    fs.readdir(dir, function(error, files) {
        if (error) return;
        files.forEach(function(file) {
            // ignore dotfiles.
            if (file.match(/^\./)) return;

            if (file.match(/.*\.json$/)) {
                fs.readFile(path.join(dir, file), function(error, data) {
                    data = JSON.parse(data);
                    data.forEach(function(record) {
                        // TODO this may need to be more robust, and perhaps
                        //      include an ID for the source.
                        record._id = 'dataset/' + record.name;
                    });

                    request({
                        uri: couch + '/_bulk_docs',
                        method: 'POST',
                        json: {docs: data}
                    }, function(error, resp, body){
                        if (error) return console.error(error)
                        console.log("import complete");
                        //console.error(resp);
                    });
                });
            }
        });
    });
}
