Portal
------

A experiment in building a very basic data directory based on CKAN, but
requiring only CouchDB.

Installation
------------

1. Install CouchDB & create a database.
2. Install node 0.4.x & npm
3. Run `npm install`
4. Run `portal.js push http://[COUCHSERVER]/[DATABASENAME]`

The `portal.js` script also has an `import` command which can import properly
formated json files into the database.

Once you have the application "pushed" you can access it at a URI like:

    http://localhost:5984/portal/_design/app/_rewrite
