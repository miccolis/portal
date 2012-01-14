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


User management
---------------

All user management, such as it is, it done on the command line using the 
`portal.js` script. All the use methods should target the user database, not
portal's own database. Most likely this database is named `_users`.

At this point there are all sorts of caveats here, at the very least  we're
polluting the couchdb users database with unclear security reprecussions. So
don't use this in a production like setting.

To create a user run the command:

    portal.js user-add http://localhost:5984/_users

You'll be prompted for a username and password. Be warned, the password will be
printed on screen as you type.


TODO
----

* Add a configuration loading system. Specifically, the application needs a way
  to be told it's own URL and the URL (which must be on the same domain) of the
  authorization server.

* Add more user commands; user-delete, user-update
