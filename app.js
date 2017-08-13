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

var superagent = require('superagent');

var mongoUrl = 'mongodb://'+process.env.MONGOIP+':27017/kodefest3';
let currentStep = '';
let currentOpData = {};
// A (hopefully) unique string so we can know if the callback queries are for us
var TYPE = "zp.0a"

var index = require('./routes/index');

var app = express();


function runBot() {
  var localeTexts = {};
  localeTexts.start = "Hola, soy el robot *@KodeFest3_bot* , y simulo operaciones bancarias básicas.\n\nRespondo a las palabras clave *registrar/Registrar*, *consultar/Consultar*, *retirar/Retirar*, *consignar/Consignar*, *transferir/Transferir*.\n\nTambién respondo a los siguientes comandos:\n/bankOperations\n/register <USER> <PASS> <AMOUNT>\n/query <ACCOUNT> <PASS>\n/withdraw <ACCOUNT> <PASS> <AMOUNT>\n/consign <ACCOUNT> <AMOUNT>\n/transfer <SOURCE> <PASS> <TARGET> <AMOUNT>";

  bot.command("start", "help", function (msg, reply, next) {
    reply.markdown(localeTexts.start);
  });

  bot.command("register", (msg, reply, next) => {
    var account = randtoken.generate(6, '0123456789')
    , [ user, pass, amount ] = msg.args(3)
    if (!user || !user.match(/^\w\S*$/) || !pass || !pass.match(/^\S{4,8}$/) || !amount || !amount.match(/^\d+$/)) return reply.text("Datos de registro inválidos.")

    MongoClient.connect(mongoUrl, function(err, db) {
      if (err) {
        reply.markdown("Error conectando con la base de datos.")
        return
      }
      var collection = db.collection('accounts');
      collection.insert(
        {user: user, pass: pass, amount: parseInt(amount), account: account},
        (err, result) => {
          if (err) reply.markdown("Error almacenando registro.")
          else reply.markdown("Registro hecho, nuevo número de cuenta generado correspondiente al usuario _"+user+"_: *"+account+"*")
        }
      );
    });
  });

  bot.command("query", (msg, reply, next) => {
    var [ account, pass ] = msg.args(2)
    if (!account || !account.match(/^\w\S*$/) || !pass || !pass.match(/^\S{4,8}$/)) return reply.text("Datos para consulta inválidos.")

    MongoClient.connect(mongoUrl, function(err, db) {
      if (err) {
        reply.markdown("Error conectando con la base de datos.")
        return
      }
      var collection = db.collection('accounts');
      collection.find({account: account, pass: pass}).toArray(function(err, docs) {
        if (err) {
          reply.markdown("Error consultando documentos.")
          return
        }
        if (docs.length === 1) reply.markdown('El monto actual de la cuenta _'+account+'_ es: *'+docs[0].amount+'*')
        else reply.markdown('Error consultando datos.')
      });
    });
  });

  bot.command("withdraw", (msg, reply, next) => {
    var [ account, pass, amount ] = msg.args(3)
    if (!account || !account.match(/^\w\S*$/) || !pass || !pass.match(/^\S{4,8}$/) || !amount || !amount.match(/^\d+$/)) return reply.text("Datos de retiro inválidos.")

    doWithdraw(reply, {account: account, pass: pass, amount: amount})
  });

  bot.command("consign", (msg, reply, next) => {
    var [ account, amount ] = msg.args(2)
    if (!account || !account.match(/^\w\S*$/) || !amount || !amount.match(/^\d+$/)) return reply.text("Datos de consignación inválidos.")

    doConsign(reply, {account: account, amount: amount})
  });

  bot.command("transfer", (msg, reply, next) => {
    var [ source, pass, target, amount ] = msg.args(4)
    if (!source || !source.match(/^\d{6}$/) || !pass || !pass.match(/^\S{4,8}$/) || !target || !target.match(/^\d{6}$/) || !amount || !amount.match(/^\d+$/)) return reply.text("Datos de transferencia inválidos.")

    doTransfer(reply, {source: source, pass: pass, target: target, amount: amount})
  });

  bot.command("bankOps", (msg, reply, next) => {
    function encodeData(action) {
      return JSON.stringify({ action: action, chatId: msg.chat.id });
    }

    var bankOpsButtons = [
      [
        { text: "\u25B6 Registrar", callback_data: encodeData("registrar") },
        { text: "\u23FA Consultar", callback_data: encodeData("consultar") }
      ],
      [
        { text: "\u2198 Retirar", callback_data: encodeData("retirar") }
      ],
      [
        { text: "\u2197 Consignar", callback_data: encodeData("consignar") },
        { text: "\u2194 Transferir", callback_data: encodeData("transferir") }
      ]
    ]

    reply.inlineKeyboard(bankOpsButtons)
    reply.text('¿Qué operación desea realizar?')
  });

  bot.command("bankOperations", (msg, reply, next) => {
    superagent
      .post('https://api.telegram.org/bot'+process.env.TGBOTTOKEN+'/sendMessage')
      .send({
        chat_id: msg.chat.id,
        text: '¿Qué operación desea realizar?',
        reply_markup: {
          keyboard: [
            ["Registrar", "Consultar"],
            ["Retirar"],
            ["Consignar", "Transferir"]
          ],
          one_time_keyboard: true
        }
      })
      .end(function(err, res){
        if (err) reply.text('Error entregando mensaje al usuario.')
      });
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
    if (msg.text==='registrar' || msg.text==='Registrar') {
      currentStep = 'user'
      reply.text('Por favor ingrese el usuario:')
    }
    if (currentStep === 'amount' && parseInt(msg.text)) {
      currentOpData.amount = msg.text
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
    if (msg.text==='retirar' || msg.text==='Retirar') {
      currentStep = 'account'
      reply.text('Por favor ingrese el número de cuenta:')
    }
  });

  bot.command((msg, reply) => reply.text("Invalid command."))

  bot.callback(function (query, next) {
    console.log(query);
    // Try to parse the query, otherwise pass it down
    try {
      var data = JSON.parse(query.data);
    } catch (e) {
      return next();
    }

    // Verify this query is, indeed, for us
    //if (data.type !== TYPE) return next();

    // Try to send the chat action where the payload says
    // DON'T DO THIS AT HOME! A bad client could manipulate the
    // value of any field and make the bot send actions to whoever he wants!
    bot.reply(data.chatId).text(data.action).then(function (err) {
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

function getInclusiveRandomInteger(start, end) {
  return Math.floor(Math.random() * (Math.floor(end) - Math.ceil(start) + 1)) + Math.ceil(start);
}

function doRegister(reply, opData) {
  opData.account = randtoken.generate(6, '0123456789')
  MongoClient.connect(mongoUrl, function(err, db) {
    if (err) {
      reply.markdown("Error conectando con la base de datos.")
      return
    }
    var collection = db.collection('accounts')
    delete opData._id
    collection.insertOne(opData, function(err, r) {
      currentStep = ''
      if (err) reply.markdown("Error almacenando registro.")
      else reply.markdown("Registro hecho, nuevo número de cuenta generado correspondiente al usuario _"+opData.user+"_: *"+opData.account+"*")
    })
  });
}

function doWithdraw(reply, opData) {
  opData.amount = parseInt(opData.amount)
  MongoClient.connect(mongoUrl, function(err, db) {
    if (err) {
      reply.markdown("Error conectando con la base de datos.")
      return
    }
    var collection = db.collection('accounts')
    collection.updateOne({account:opData.account, pass:opData.pass}, {$inc: {amount: -opData.amount}}, function(err, r) {
      currentStep = ''
      if (err) reply.markdown("Error actualizando registro.")
      else reply.markdown("Retiro hecho, monto actualizado.")
    })
  });
}

function doConsign(reply, opData) {
  opData.amount = parseInt(opData.amount)
  MongoClient.connect(mongoUrl, function(err, db) {
    if (err) {
      reply.markdown("Error conectando con la base de datos.")
      return
    }
    var collection = db.collection('accounts')
    collection.updateOne({account:opData.account}, {$inc: {amount: opData.amount}}, function(err, r) {
      currentStep = ''
      if (err) reply.markdown("Error actualizando registro.")
      else reply.markdown("Consignación hecha, monto actualizado.")
    })
  });
}

function doTransfer(reply, opData) {
  opData.amount = parseInt(opData.amount)
  MongoClient.connect(mongoUrl, function(err, db) {
    if (err) {
      reply.markdown("Error conectando con la base de datos.")
      return
    }
    var collection = db.collection('accounts')
    collection.find({account: opData.target}).toArray(function(err, docs) {
      if (err) {
        reply.markdown("Error consultando documentos.")
        return
      }
      if (docs.length === 1) {
        collection.find({account: opData.source, pass: opData.pass}).toArray((err, docs) => {
          if (err) {
            reply.markdown("Error consultando documentos.")
            return
          }
          if (docs.length === 1) {
            collection.updateOne({account: opData.source}, {$inc: {amount: -opData.amount}}, (err, r) => {
              if (err) reply.markdown('Error actualizando cuenta orígen.')
              else {
                collection.updateOne({account: opData.target}, {$inc: {amount: opData.amount}}, (err, r) => {
                  if (err) reply.markdown('Error actualizando cuenta destino.')
                  else reply.markdown('Transferencia realizada.')
                });
              }
            });
          }
          else reply.markdown('Error consultando cuenta orígen.')
        });
      }
      else reply.markdown('Error consultando cuenta destino.')
    });
  });
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
