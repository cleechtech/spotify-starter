var express = require('express'),
	path = require('path'),
	jwt = require('jsonwebtoken'),
	request = require('request'),
	SpotifyWebApi = require('spotify-web-api-node'),
	utils = require('./utils'),
	rootPath = path.normalize(__dirname + '/../'),
	apiRouter = express.Router(),
	User = require('./models/user'),
	router = express.Router();

module.exports = function(app){	
	// Make Spotify Authorization request url
	var scopes = ['user-read-private', 'user-read-email'];
	var state = 'some-state-of-my-choice';
	var redirectUri = 'http//:localhost:3000/api/spotify/callback';
	var SPOTIFY_CLIENT_ID = '68e85fc65d524c1fb18f5c0d0a251fc2';
	var SPOTIFY_CLIENT_SECRET = 'a89c5456c0234e9abf45ee9ce6e01f88';

	var spotifyApi = new SpotifyWebApi({
		redirectUri : redirectUri,
		clientId : SPOTIFY_CLIENT_ID
	});

	var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
	console.log(authorizeURL);

	// Spotify login
	// apiRouter.get('/login/spotify', function(req, res){
	// 	request(authorizeURL, function (error, response, body) {
	// 		if (!error && response.statusCode == 200) {
	// 			res.json(response);
	// 		}
	// 	})
	// });

	// Spotify callback
	apiRouter.get('/spotify/callback', function(req, res){		
		res.sendFile(rootPath + 'public/callbackBox.html', {});
	});

	// Users
	// all users
	apiRouter.get('/users', authenticate, function(req, res){
		User.find({}, function(err, users){
			res.json(users);
		});
	});

	// add user
	apiRouter.post('/users', function(req, res){

		utils.hashPwd(req.body.password).then(function(hashedPwd){

			var newUser = new User({
				email: req.body.email,
				password: hashedPwd,
				admin: false
			});

			newUser.save(function(err){
				if(err) throw err;

				// create token
				var token = jwt.sign(newUser, app.get('superSecret'), { expiresInminutes: 1440 });

				newUser.password = undefined;

				// send token
				res.json({
					success: true,
					message: 'Successfully authenticated!',
					token: token,
					user: newUser
				});
			});
		});
		
	});

	// authenticate user
	apiRouter.post('/users/auth', function(req, res){

		// add back the password field for this query
		var query = User.findOne({
			email: req.body.email
		}).select('_id email +password');

		query.exec(function(err, user){
			if(err) throw err;

			if(!user){
				res.json({ success: false, message: 'No user with that email' });
			} else if(user){

				// check password
				utils.comparePwd(req.body.password, user.password).then(function(isMatch){
					if(!isMatch){
						res.json({ success: false, message: 'Wrong password' });
					} else {

						// create token
						var token = jwt.sign(user, app.get('superSecret'), { expiresInminutes: 1440 });

						user.password = undefined;

						// send token
						res.json({
							success: true,
							message: 'Successfully authenticated!',
							token: token,
							user: user
						});
					}
				});
			}
		});
	});

	// angularjs catch all route
	router.get('/*', function(req, res) {
		res.sendFile(rootPath + 'public/index.html', { user: req.user });
	});

	app.use('/api', apiRouter);
	app.use('/', router);

	// middleware
	function authenticate(req, res, next){
	  var token = req.body.token || req.query.token || req.headers['x-access-token'];

	  console.log(req.headers);
	  if (token) {

	  	// verify token validity
	    jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
	      if (err) {
	        return res.json({ success: false, message: 'Failed to authenticate token.' });    
	      } else {
	        req.decoded = decoded;    
	        next();
	      }
	    });

	  } else {

	    return res.status(403).send({ 
	        success: false, 
	        message: 'No token provided.' 
	    });
	    
	  }
	}
};

