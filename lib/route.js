var nconf = require('nconf');
var url = require('url');
var path = require('path');
var fs = require('fs');
var buffer = require('buffer');
var ejs = require('ejs');
var mime = require('mime');
var OAuth2 = require("oauth").OAuth2;

// library
var Template = require(nconf.get('base')+'/lib/template');
var utils = require(nconf.get('base')+'/lib/utils');
var timeline = require(nconf.get('base')+'/lib/timeline');

// module(sources)
var wikipedia = require(nconf.get('base')+'/mod/wikipedia');

var route = {};

route.run = function(req, res){
  var uri = url.parse(decodeURIComponent(req.url)).pathname;
    
  // deliver static file directly, only when proxy not enabled
  if(!nconf.get('proxy')){
    var filename = path.join('pub', uri).replace(/\/+$/, '');
    var cache = filename.replace('pub/', 'pub/cache/');
    if(fs.existsSync(filename) && !fs.lstatSync(filename).isDirectory()){
      res.mimetype = mime.lookup(filename);
      route.deliver('static', filename, res);
      return;
    }
    else
    if(fs.existsSync(cache) && !fs.lstatSync(cache).isDirectory()){
      res.mimetype = mime.lookup(cache);
      route.deliver('static', cache, res);
      return;
    }
  }

  // prepare arguments
  var args = uri.replace(/^\/+|\/+$/g, '').split('/');
  if(args[args.length-1].lastIndexOf('.') === -1){
    var ext = 'html';
  }
  else{
    args[args.length-1].lastIndexOf('.') === -1
    var ext = args[args.length-1].split('.').pop();
    args[args.length-1] = args[args.length-1].replace('.'+ext, '');
  }
  var mod = args[0];
  if(!mod){
    args[0] = mod = 'index'; // frontpage
  }

  // TODO: support override option
  // var option = {};

  if( mod == "gitAuth"){
    var clientId = nconf.get('gitAppId');
    var secret = nconf.get('gitAppSecret');
    var oauth = new OAuth2(clientId, secret, "https://github.com/", "login/oauth/authorize", "login/oauth/access_token");

	res.writeHead(303, {
		Location: oauth.getAuthorizeUrl({
			redirect_uri: 'http://'+req.headers.host+'/errreport/sendIssue/'+args[1],
			scope: "user,repo,gist"
		})
	});
	res.end();
	return;
  }
  
  fs.exists('mod/'+mod+'.js', function(exists){
    if(exists){
      var page = require("../mod/" + mod);
      var tpl = new Template();

      // global params for template
      tpl.set('url', 'http://'+req.headers.host+req.url);
      tpl.set('base_url', 'http://'+req.headers.host);
      tpl.set('host', req.headers.host);
      tpl.set('template', mod);
      tpl.set('remoteIP',req.connection.remoteAddress);
	  tpl.set('req_url', req.url);
      
      // retrieve the 'POST' content
      var postBody='';
      if(req.method=='POST') {
        done=0;
        req.on('data', function (data) {
          postBody +=data.toString('utf8');
        });
        req.on('end',function(){
          done=1;
        });
        while(done==1);
      }
      tpl.set('post',postBody);
      
      // route for prepare params for template
      page.route(tpl, args, ext, function(err){
        // render template
        if(!err){
          if(!ext || ext == 'html' || ext == 'htm'){
            res.mimetype = 'text/html';
          }
          else if(ext == 'json'){
            res.mimetype = 'application/json';
          }
          else{
            res.mimetype = 'text/plain';
          }
          res.args = args;
          res.ext = ext;
          route.deliver(mod, tpl.export(), res);

          // release memory
          tpl = null;
          return;
        }
        else{
          console.log(err);
          route.deliver('error', null, res);
        }
      });
    }
  });
}

route.deliver = function(type, params, res){
  // pipe static file directly
  if(type == 'static'){
    var filename = params; // params is filename
    fs.stat(filename, function(err, stat){
      var head = {"Content-Type":res.mimetype, "Content-Length":stat.size};
      // streaming or not ? https://github.com/substack/stream-handbook#why-you-should-use-streams
      // but I suffer very strange slow streaming problem
      fs.createReadStream(filename, {flags:'r', mode: 0666, bufferSize: 256 * 1024 }).pipe(res);
    });
  }
  else if(type !== 'error'){
    if(res.mimetype == 'application/json'){
      var head = {"Content-Type": res.mimetype, "X-Twangry":"HIT"};
      res.writeHead(200, head);
      res.end(params.json);
    }
    else if(type == "errreport"){
      if(params.content=='redirect'){
        res.writeHead(303,{Location:params.issuePage});
        res.end();
      }
      else{
        res.writeHead(200, "");
        res.end(params.content);
      }
    }
    else{
      var filename = 'tpl/'+type+'.ejs';
      fs.readFile(filename, 'utf-8', function(err, data){
        if (err){
          res.writeHead(404);
          res.write("Not Found");
          res.end();
        }
        else{
          params.filename = filename;
          var html = ejs.render(data, params);
          if(nconf.get('cache') === 1){
            var cache_path = 'pub/cache/'+res.args.join('/')+'.'+res.ext;
            fs.writeFile(cache_path, html, function(err){
              if(err){
                console.log('ERR: Can\'t save cache file. code:' + err);
              }
            });
          }
          var head = {"Content-Type": res.mimetype, "X-Twangry":"HIT"};
          res.writeHead(200, head);
          res.end(html);
        }
      });
    }
  }
  else{
    res.writeHead(404);
    res.write("Not Found");
    res.end();
  }
}

module.exports = route;
