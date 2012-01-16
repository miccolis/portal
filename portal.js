#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var readline = require('readline');
var exec = require('child_process').exec;
var request = require('request');

var node = process.argv.shift();
var bin = process.argv.shift();
var command = process.argv.shift();
var couch = process.argv.shift();

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
      , "  user-add: Create a user."
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
                    });
                });
            }
        });
    });
}

if (command =='user-add') {
    var i = readline.createInterface(process.stdin, process.stdout);

    var askName = function(callback) {
        var allowed = /^[-_.a-zA-Z0-9]{3,}$/
        i.question('User name: ', function(input) {
            input = input.trim();
            if (!allowed.test(input)) {
                console.log('Sorry, bad user name. Try again.');
                return askName(callback);
            }
            callback(input)
        });
    }

    var askPass = function(callback) {
        var allowed = /^[a-zA-Z0-9]{5,}$/
        // TODO make this invisible
        i.question('Password: ', function(input) {
            input = input.trim();
            if (!allowed.test(input)) {
                console.log('Sorry. Passwords my contain letters and numbers only and must be 6 characters or longer.');
                return askPass(callback);
            }
            callback(input)
        });
    }

    askName(function(name) {
        // TODO make sure users doesn't already exist before proceeding.
        askPass(function(pass) {
            i.close();
            process.stdin.destroy();

            // TODO generate a better salt, make configurable, etc.
            var salt = '23f3fd77a464cbe250150f60d785f08978d07e40'
            var hash = crypto.createHash('sha1');
            hash.update(pass);
            hash.update(salt);
            pass = hash.digest('hex');

            var record = {
                _id:  "org.couchdb.user:" + name,
                type: "user",
                name: name,
                roles: ['portal'], // TODO tie this to the instance.
                password_sha: pass,
                salt: salt
            };

            request({
                uri: couch,
                method: 'POST',
                json: record
            }, function(error, resp, body){
                if (error) return console.error(error)
                console.log("Created user");
            });
        });
    });
}
