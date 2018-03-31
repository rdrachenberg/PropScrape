// create variables to require controllers
var fetched = require("../../controllers/fetch");
var notes = require("../../controllers/note");
var story = require("../../controllers/headline");

module.exports = function(app) {

    app.get('/', fetching.HelloWorld);
    app.get('/scrape', fetching.HelloScrape);
    app.get('/articles', stories.HelloArticles);
    app.get('/articles/:id', notesies.HelloArticlesID);
    app.post('/articles/:id', notesies.HelloArticlesNote);
