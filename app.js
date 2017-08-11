var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var index = require('./routes/index');

var app = express();


function runBot() {
  var botgram = require("botgram");
  var bot = botgram(process.env.TGBOTTOKEN);

  var MongoClient = require('mongodb').MongoClient
    , assert = require('assert');

  var mongoUrl = 'mongodb://216.189.151.196:27017/moviet00';

  // A (hopefully) unique string so we can know if the callback queries are for us
  var TYPE = "zp.0a";

  var localeTexts = {};
  localeTexts.start = "Hola, soy el robot *@FamousObjectsFromClassicMovies_bot* , con el comnado /movieThings proveo un juego en el que se adivina el nombre de una película según la imagen que aparezca.\n\nEste robot también es una *calculadora*, enviando comandos del tipo: \n/sum num1 num2 \n/substract num1 num2 \n/product num1 num2 \n/divide num1 num2\n\nEste robot también es un *notificador*, se agenda una notificación con: /alert <SEGUNDOS> <TEXTO>\n\nEste robot también almacena datos en una base de datos: /storage <TEXT>";

  bot.command("start", "help", function (msg, reply, next) {
    reply.markdown(localeTexts.start);
  });

  bot.command("alert", (msg, reply) => {
    var [ seconds, text ] = msg.args(2)
    if (!seconds.match(/^\d+$/) || !text) return reply.text("Invalid arguments.")

    setTimeout(() => reply.text(text), Number(seconds) * 1000)
  })

  bot.command("sum", (msg, reply) => {
    var [ op1, op2 ] = msg.args(2)
    if (!op1.match(/^\d+$/) || !op2.match(/^\d+$/)) return reply.text("Invalid operands.")

    reply.text(parseInt(op1) + parseInt(op2))
  })

  bot.command("substract", (msg, reply) => {
    var [ op1, op2 ] = msg.args(2)
    if (!op1.match(/^\d+$/) || !op2.match(/^\d+$/)) return reply.text("Invalid operands.")

    reply.text(parseInt(op1) - parseInt(op2))
  })

  bot.command("product", (msg, reply) => {
    var [ op1, op2 ] = msg.args(2)
    if (!op1.match(/^\d+$/) || !op2.match(/^\d+$/)) return reply.text("Invalid operands.")

    reply.text(parseInt(op1) * parseInt(op2))
  })

  bot.command("divide", (msg, reply) => {
    var [ op1, op2 ] = msg.args(2)
    if (!op1.match(/^\d+$/) || !op2.match(/^\d+$/)) return reply.text("Invalid operands.")

    reply.text(parseInt(op1) / parseInt(op2))
  })

  bot.command("movieThings", function (msg, reply, next) {
    function encodeData(action) {
      return JSON.stringify({ type: TYPE, action: action, chatId: msg.chat.id });
    }

    var moviesReplyButtons = [
      { text: "Movie 01", callback_data: encodeData("upload_photo") },
      { text: "An american lobster in Paris", callback_data: encodeData("upload_photo") },
      { text: "Borat", callback_data: encodeData("upload_photo") },
      { text: "Inception - El orígen", callback_data: encodeData("upload_photo") },
      { text: "Shrek", callback_data: encodeData("upload_photo") },
      { text: "Movie 06", callback_data: encodeData("upload_photo") },
      { text: "Movie 07", callback_data: encodeData("upload_photo") },
      { text: "So i married a cropduster", callback_data: encodeData("upload_photo") },
      { text: "The silence of the lambs - El silencio de los inocentes", callback_data: encodeData("upload_photo") },
      { text: "Movie 10", callback_data: encodeData("upload_photo") },
      { text: "Movie 11", callback_data: encodeData("upload_photo") },
      { text: "Movie 12", callback_data: encodeData("upload_photo") },
      { text: "Blood Diamond", callback_data: encodeData("upload_photo") },
      { text: "Movie 14", callback_data: encodeData("upload_photo") },
      { text: "American Psycho", callback_data: encodeData("upload_photo") },
      { text: "Movie 16", callback_data: encodeData("upload_photo") },
      { text: "El profesional - The Professional - El perfecto asesino", callback_data: encodeData("upload_photo") },
      { text: "Movie 18", callback_data: encodeData("upload_photo") }
    ]

    reply.inlineKeyboard(responseOptions(moviesReplyButtons));

    reply.markdown("¿A qué película corresponde ese objeto?");
  });

  bot.command("storage", (msg, reply, next) => {
    var [ text ] = msg.args(1)
    if (!text || text === '') return reply.text("Invalid operands.")

    // Use connect method to connect to the Server
    MongoClient.connect(mongoUrl, function(err, db) {
      assert.equal(null, err);
      console.log("Connected correctly to server");
      var collection = db.collection('movies1');
      collection.insert(
        {text: text},
        (err, result) => {
          assert.equal(err, null);
          console.log("Inserted document into the collection");
          reply.text("Inserted document into the collection")
        }
      );
    });
  });

  bot.command((msg, reply) => reply.text("Invalid command."))

  bot.callback(function (query, next) {
    // Try to parse the query, otherwise pass it down
    try {
      var data = JSON.parse(query.data);
    } catch (e) {
      return next();
    }

    // Verify this query is, indeed, for us
    if (data.type !== TYPE) return next();

    // Try to send the chat action where the payload says
    // DON'T DO THIS AT HOME! A bad client could manipulate the
    // value of any field and make the bot send actions to whoever he wants!
    bot.reply(data.chatId).action(data.action).then(function (err) {
      if (err)
        return query.answer({ text: "Couldn't send the chat action, can the bot talk here?" });
      query.answer();
    });

    // Encoding request data in callback_data is practical but
    // shouln't be done in production because callback_data can
    // only be up to 64 bytes long, and a client could send
    // specially crafted data, such as:
    //
    //     { "type": TYPE }
    //
    // which would make this code crash at the call to bot.reply(...)
  });
}

function responseOptions(moviesReplyButtons) {
  return [[moviesReplyButtons[0], moviesReplyButtons[1]], [moviesReplyButtons[2], moviesReplyButtons[3]]]
}

function getInclusiveRandomInteger(start, end) {
  return Math.floor(Math.random() * (Math.floor(end) - Math.ceil(start) + 1)) + Math.ceil(start);
}

runBot();


// view engine setup
app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error.jade');
});

module.exports = app;
