var mongoose = require('mongoose');
var Post = mongoose.model('Post');
var Comment = mongoose.model('Comment');
var passport = require('passport');
var User = mongoose.model('User');
var jwt = require('express-jwt');
var auth = jwt({secret: 'SECRET', userProperty: 'payload'});
var express = require('express');
var router = express.Router();
var fs = require('fs');
var nodemailer = require('nodemailer');
var async = require('async');
var cypto = require('crypto');
var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user:'donaldduck518@gmail.com',
    pass: 'biblecashier',
    secure: true
  }
});

/* For Email Server */
router.post('/forgotPwd', function(req, res, next) {

  async.waterfall([
    function(done) {
      cypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ username: req.body.email }, function(err, user) {
        if (!user) {
          return res.status(400).json({ message: 'No account with that email address exists.'});
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });

      });
    },
    function(token, user, done) {
      var mailOptions = {
        from: 'donaldduck518@gmail.com',
        to: user.username,
        subject: 'Flapper Neews Password Reset',
        text: 'Please click on the following link to reset your password:\n\n' +
        'http://' + req.headers.host + '/reset/' + token + '\n\n',
      }
      transporter.sendMail(mailOptions, function(error, info) {
        done(error, info.response);

      });
    }
  ], function(err, data) {
      if (err) res.json({error: err});
      else return res.json({yo: data});
  });

});

router.get('/reset/:token', function(req, res, next) {
  User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() }
  }, function(err, user) {
    if (!user) {
      return res.status(400).json({ message: 'Password reset token is invalid or has expired'});
    }

    res.redirect('/#/resetPwd?tokenId=' + user.resetPasswordToken);
    // res.json({user: user});

  });
});

router.post('/resetPwd/:token', function(req, res, next) {
  async.waterfall([
    function(done) {
      User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: { $gt: Date.now() }
      }, function(err, user) {
        if(!user) {
          return res.status(400).json({ message: 'Password reset token is invalid or has expired'});
        }

        user.setPassword(req.body.newPwd);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        user.save(function(err) {
          //TODO: LogIn for user
          done(err, user);
        });

      })
    },
    function(user, done) {
      var mailOptions = {
        from: 'donaldduck518@gmail.com',
        to: user.username,
        subject: 'Your password has been changed',
        text: 'This is a confirmation that the password for your account ' +
        user.email + ' has just been changed.\n'
      };
      transporter.sendMail(mailOptions, function(error, info) {
        done(error, info.response);

      });
    }
  ], function(err, data) {
    if (err) res.json({error: err});
    else return res.json({yo: data});

  })
});

/* GET all posts */
router.get('/posts', function(req, res, next) {
  Post.find(function(err, posts) {
    if (err) return next(err);
    res.json(posts);
  });
});

router.post('/posts', auth, function(req, res, next) {
  var post = new Post(req.body);
  post.author = req.payload.username;
  post.save(function(err, post) {
    if (err) return next(err);

    res.json(post);
  });
});

router.param('post', function(req, res, next, id) {
  var query = Post.findById(id);

  query.exec(function (err, post) {
    if (err) return next(err);
    if (!post) return next(new Error('can\'t find post'));

    req.post = post;
    return next();
  });
});

router.get('/posts/:post', function(req, res) {
  req.post.populate('comments', function(err, post) {
    if (err) return next(err);

    res.json(req.post);
  });

});

router.put('/posts/:post/upvote', auth, function(req, res, next) {
  req.post.upvote(function(err, post) {
    if (err) return next(err);

    res.json(post);
  });
});

router.post('/posts/:post/comments', auth, function(req, res, next) {
  var comment = new Comment(req.body);
  comment.post = req.post;
  comment.author = req.payload.username;
  comment.save(function(err, comment) {
    if (err) return next(err);

    req.post.comments.push(comment);
    req.post.save(function(err, post) {
      if (err) return next(err);

      res.json(comment);
    });
  });

});

router.param('comment', function(req, res, next, id) {
  var query = Comment.findById(id);

  query.exec(function (err, comment) {
    if (err) return next(err);
    if (!comment) return next(new Error('can\'t find comment'));

    req.comment = comment;
    return next();
  });
});

router.put('/posts/:post/comments/:comment/upvote', auth, function(req, res, next) {
  req.comment.upvote(function(err, comment) {
    if (err) return next(err);

    res.json(comment);
  });
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/register', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({message: 'Please fill out all fields'});
  }

  var user = new User();

  user.username = req.body.username;
  user.setPassword(req.body.password);
  user.save(function (err) {
    if (err) return next(err);

    return res.json({token: user.generateJWT()});
  });
});

router.post('/login', function(req, res, next) {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ message: 'Please fill out all fields'});
  }

  passport.authenticate('local', function(err, user, info) {
    if (err) { return next(err); }

    if (user) {
      return res.json( {token: user.generateJWT()});
    } else {
      return res.status(401).json(info);
    }
  })(req, res, next);
})

module.exports = router;
