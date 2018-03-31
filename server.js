// ***********************************************************************
// Dependencies
// ***********************************************************************
var express = require("express");
var mongojs = require("mongojs");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var request = require("request")
var cheerio = require('cheerio')
var app = express();
var path = require("path");
var axios = require("axios");
var http = require("http");
var fn = require("fn");
// ***********************************************************************
// Require Models
// ***********************************************************************

var Note = require("./models/Note.js");
var Article = require("./models/Headline.js");
// ***********************************************************************
// set up env and localhost PORT
// ***********************************************************************
var PORT = process.env.PORT || 3003;
var exphbs = require("express-handlebars");
// ***********************************************************************
// start express handlebars engine 
// ***********************************************************************
app.engine(
  "handlebars",
  exphbs({
    defaultLayout: "main",
    partialsDir: path.join(__dirname, "/views/layouts/partials")
  })
);
app.set("view engine", "handlebars");
// **********************************************************************
// Morgan: 
// red for server error codes,yellow for client error codes, cyan for redirection codes, and uncolored for all other codes.
// ***********************************************************************
app.use(logger("dev"));
// **********************************************************************
// Setup the app with body-parser and a static folder
// ***********************************************************************
app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
app.use(express.static(__dirname + "/public"));
app.use(express.static("/models"));
// ***********************************************************************
// require router countrollers and give the server access to it.
// ***********************************************************************
var router = require("./controllers/fetch");
var router = require("./controllers/headline");
var router = require("./controllers/note");
app.use("/", router); 

// ***********************************************************************
// Database configuration
// ***********************************************************************
var databaseUrl = "propScrap_db";
var collections = ["scrapedArticles"];
// If deployed, use the deployed database. Otherwise use the local propScrap_db database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/propScrap_db";
// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, {
  // useMongoClient: true
});
// Hook mongojs configuration to the db variable
var db = mongojs(databaseUrl, collections);
db.on("error", function(error) {
  console.log("Database Error:", error);
});
// ***********************************************************************
// Main route 
// ***********************************************************************
//Render Handlebars pages through GET
app.get("/", function(req, res) {
  Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});
// ***********************************************************************
// Scrape the New York Times website 
// ***********************************************************************
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("https://www.nytimes.com/", function(error, response, html) {
    // load cheerio 
    var $ = cheerio.load(html);
    // Now, we grab every h2 within an article tag, and do the following:
    $("article").each(function(i, element) {

      // Save an empty result object
      var result = {};

      // Add the title and summary of every link, and save them as properties of the result object
      result.title = $(this).children("h2").text();
      result.summary = $(this).children(".summary").text();
      result.link = $(this).children("h2").children("a").attr("href");

      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });
    });
        // res.send("Scrape Complete");
        res.redirect("/");

  });
});
// ***********************************************************************
// Retrieve data from the db
// ***********************************************************************
app.get("/all", function(req, res) {
  // Find all results from the scrapedArticles collection in the db
  Article.find({}, function(error, found) {
    // Throw any errors to the console
    if (error) {
      console.log(error);
    }
    // If there are no errors, send the data to the browser as json
    else {
      res.json(found);
    }
  });
});
// ***********************************************************************
// Retrieve Saved data from the db
// ***********************************************************************
app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});

// ***********************************************************************
// GET articles from the mongoDB
// ***********************************************************************
app.get("/articles", function(req, res) {
  // Get any Articles from the Articles array
  Article.find({}, function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Or send the doc to the browser as a json object
    else {
      res.json(doc);
    }
  });
});
// ***********************************************************************
// GET an article by the Id
// ***********************************************************************e
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  Article.findOne({ "_id": req.params.id })
  // ..and populate all of the notes associated with it
  .populate("note")
  // now, execute our query
  .exec(function(error, doc) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise, send the doc to the browser as a json object
    else {
      res.json(doc);
    }
  });
});
// ***********************************************************************
// POST an UPDATE an article to the db
// ***********************************************************************
app.post("/articles/save/:id", function(req, res) {
      // Use the article id to find and update its saved boolean
      Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
      // Execute the above query
      .exec(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        else {
          // Or send the document to the browser
          res.send(doc);
        }
      });
});
// ***********************************************************************
// Delete an article
// ***********************************************************************
app.post("/articles/delete/:id", function(req, res) {
      // Use the article id to find and update its saved boolean
      Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
      // Execute the above query
      .exec(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        else {
          // Or send the document to the browser
          res.send(doc);
        }
      });
});
// ***********************************************************************
// Create a new note
// ***********************************************************************
app.post("/notes/save/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  // And save the new note the db
  newNote.save(function(error, note) {
    // Log any errors
    if (error) {
      console.log(error);
    }
    // Otherwise
    else {
      // Use the article id to find and update it's notes
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
      // Execute the above query
      .exec(function(err) {
        // Log any errors
        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
          // Or send the note to the browser
          res.send(note);
        }
      });
    }
  });
});
// ***********************************************************************
// Delete a note
// ***********************************************************************
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
  // Use the note id to find and delete it
  Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
    // Log any errors
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
       // Execute the above query
        .exec(function(err) {
          // Log any errors
          if (err) {
            console.log(err);
            res.send(err);
          }
          else {
            // Or send the note to the browser
            res.send("Note Deleted");
          }
        });
    }
  });
});
// ***********************************************************************
// log successful database connection 
// // ***********************************************************************
db.once("open", function() {
  console.log("Mongoose connection successful.");
});
// ***********************************************************************
// Listen on port 3003
// ***********************************************************************
app.listen(PORT, function() {
  console.log("🌎  Listening on port %s.  🌎 ", PORT);
});
// ***********************************************************************
// end server.js file 
// ***********************************************************************
