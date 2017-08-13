var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var botgram = require("botgram");
var bot = botgram(process.env.TGBOTTOKEN);

var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');

var randtoken = require('rand-token');

var mongoUrl = 'mongodb://216.189.151.196:27017/moviet00';
let currentStep = '';
let currentOpData = {};
let inGetUser = inGetAccount = inGetPass = inGetAmount = false;

var index = require('./routes/index');

var app = express();


function runBot() {
  // A (hopefully) unique string so we can know if the callback queries are for us
  var TYPE = "zp.0a";

  var localeTexts = {};
  localeTexts.start = "Hola, soy el robot *@KodeBank_bot* , y simulo operaciones básicas de un banco:\n/registerAccount <USER> <PASS>\n/withdraw <USER> <PASS> <AMOUNT>\n\nEste robot también es una *calculadora*, enviando comandos del tipo:\n/sum num1 num2\n/substract num1 num2\n/product num1 num2\n/divide num1 num2\n\nEste robot también es un *notificador*, se agenda una notificación con: /alert <SEGUNDOS> <TEXTO>\n\nEste robot también almacena datos en una base de datos: /storage <TEXT>";

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

  bot.command("registerAccount", (msg, reply, next) => {
    var [ user, pass, amount ] = msg.args(3)
    if (!user.match(/^\w\S*$/) || !pass.match(/^\S{4,8}$/) || !amount.match(/^\d+$/)) return reply.text("Invalid register data.")

    MongoClient.connect(mongoUrl, function(err, db) {
      assert.equal(null, err);
      console.log("Connected correctly to server");
      var collection = db.collection('movies1');
      collection.insert(
        {user: user, pass: pass, amount: amount},
        (err, result) => {
          assert.equal(err, null);
          console.log("Nueva cuenta registrada.");
          reply.text("Nueva cuenta registrada.")
        }
      );
    });
  });

  bot.command("withdraw", (msg, reply, next) => {
    var [ user, pass, amount ] = msg.args(3)
    if (!user.match(/^\w\S*$/) || !pass.match(/^\S{4,8}$/) || !amount.match(/^\d+$/)) return reply.text("Invalid operands.")

    doWithdraw()
  });

  bot.text((msg, reply, next) => {
    if (currentStep==='register_amount' && parseInt(msg.text)) {
      currentOpData.amount = parseInt(msg.text)
      doRegister(reply, currentOpData)
    }
    if (currentStep==='register_pass' && msg.text) {
      currentOpData.pass = msg.text
      currentStep = 'register_amount'
      reply.text('Por favor ingrese el monto inicial:')
    }
    if (currentStep==='user' && !parseInt(msg.text)) {
      currentOpData.user = msg.text
      currentStep = 'register_pass'
      reply.text('Por favor ingrese la clave:')
    }
    if (msg.text === 'registrar') {
      currentStep = 'user'
      reply.text('Por favor ingrese el usuario:')
    }
    if (currentStep === 'amount' && parseInt(msg.text)) {
      currentOpData.amount = parseInt(msg.text)
      doWithdraw(reply, currentOpData)
    }
    if (currentStep==='pass' && msg.text) {
      currentStep = 'amount'
      currentOpData.pass = msg.text
      reply.text('Por favor ingrese el monto a retirar:')
    }
    if (currentStep==='account' && parseInt(msg.text)) {
      currentOpData.account = msg.text
      currentStep = 'pass'
      reply.text('Por favor ingrese la clave:')
    }
    if (msg.text === 'retirar') {
      currentStep = 'account'
      reply.text('Por favor ingrese el número de cuenta:')
    }
  });

  bot.command((msg, reply) => reply.text("Invalid command."))
}

function simpleCallback(result) {
  console.log(result);
}

function responseOptions(moviesReplyButtons) {
  return [[moviesReplyButtons[0], moviesReplyButtons[1]], [moviesReplyButtons[2], moviesReplyButtons[3]]]
}

function getInclusiveRandomInteger(start, end) {
  return Math.floor(Math.random() * (Math.floor(end) - Math.ceil(start) + 1)) + Math.ceil(start);
}

function doRegister(reply, opData) {
  opData.account = randtoken.generate(6, '0123456789')
  MongoClient.connect(mongoUrl, function(err, db) {
    assert.equal(null, err)
    console.log("Connected correctly to server")
    var collection = db.collection('movies1')
    delete opData._id
    collection.insertOne(opData, function(err, r) {
      assert.equal(null, err)
      currentStep = ''
      console.log("Registro hecho, nuevo número de cuenta generado correspondiente al usuario _"+opData.user+"_: *"+opData.account+"*")
      reply.markdown("Registro hecho, nuevo número de cuenta generado correspondiente al usuario _"+opData.user+"_: *"+opData.account+"*")
    })
  });
}

function doWithdraw(reply, opData) {
  MongoClient.connect(mongoUrl, function(err, db) {
    assert.equal(null, err)
    console.log("Connected correctly to server")
    var collection = db.collection('movies1')
    collection.updateOne({account:opData.account, pass:opData.pass}, {$inc: {amount: -opData.amount}}, function(err, r) {
      assert.equal(null, err)
      assert.equal(1, r.matchedCount)
      assert.equal(1, r.modifiedCount)
      console.log("Retiro hecho, monto actualizado.")
      reply.text("Retiro hecho, monto actualizado.")
    })
  });
}

function getPass(reply) {
  inGetPass = true
  reply.text('Por favor ingrese la clave:')
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
