var nodemailer = require('nodemailer');
var ccap = require('ccap');
var nconf = require('nconf');

var captchaArr = {};
var counter = 0;
var errreport = {};
var issueArr = {};

var Url = require("url");
var querystring = require("querystring");
var OAuth2 = require("oauth").OAuth2;
var Client = require("github");
var github = new Client({
    version: "3.0.0"
});
var clientId = nconf.get('gitAppId');
var secret = nconf.get('gitAppSecret');

var oauth = new OAuth2(clientId, secret, "https://github.com/", "login/oauth/authorize", "login/oauth/access_token");
var accessToken = "";
var issueCount = 0;

errreport.route = function(tpl, args, ext, callback){
  remoteIP=tpl.get('remoteIP');
  
  if( args[1] == "getCaptcha"){
    console.log(remoteIP);
    var captcha = ccap();
    var ary = captcha.get();
    //captchaArr[counter] = ary[0];
    args[2] = ary[1];
    console.log(ary[0]);
    counter++;
    remoteIP=tpl.get('remoteIP');
    captchaArr[remoteIP]=ary[0];
  }
  else if(args[1] == "sendIssue"){
  
	var url = Url.parse(tpl.get('req_url'));
	var path = url.pathname;
    var query = querystring.parse(url.query);
	
  
	oauth.getOAuthAccessToken(query.code, {}, function (err, access_token, refresh_token) {
		if (err) {
			console.log("Auth error!!!!!");
		}
		
		accessToken = access_token;
		
		// authenticate github API
		github.authenticate({
			type: "oauth",
			token: accessToken
		});
		
		var issueNum = args[2];
		// send issue
		github.issues.create({
                "user": "alice1992224",
                "repo": "twangry",
                "encoding": "utf-8",
                "title": issueArr[issueNum]['title'],
                "body": issueArr[issueNum]['body'],
                "labels": [
                    "Temp!!!"
                ]
            },
            function(err, issue){
                github.issues.deleteLabel(
                  {
                      user: "alice1992224",
                      repo: "twangry",
                      name: "Temp!!!"
                  },function(err, issue){
                    console.log("Create issue end");
                  }
                );
            }
        );
	});
  }
  else{
      var transport = nodemailer.createTransport("Direct", {debug: true});
      myPost=tpl.get('post');
      tpl.set('post','');//clear
      myPost=JSON.parse(myPost);
      console.log("a:"+myPost['captcha']);
      console.log("b:"+captchaArr[remoteIP]);
      if(myPost['captcha']!=captchaArr[remoteIP]){
        args[2]="failed";
        callback();
        return;
      }
      else{
        args[2]="succeeded";
        delete captchaArr[remoteIP];
      }
      
	  issueArr[issueCount] = {
		id: issueCount,
		title: myPost['title'],
		body: myPost['content']
      };
	  var htmlContent="<a href='"+tpl.get('base_url')+"/gitAuth/"+issueCount+"'>送出 issue</a><br/>";
      console.log(htmlContent);
      // Fill the email
      var message = {
          from: '\"'+myPost['name']+'\" <'+myPost['email']+'>',
          to: nconf.get('mailList'),
          subject: 'g0v政誌 Error Report--'+myPost['title'], 
          //text: myPost['content'],
		  html: myPost['content'].replace(/\n/g,"<br />")+"<br /><br />按這裡"+htmlContent
      };
	  
	  if(issueCount < 100){
		issueCount+=1;
	  }
	  else{
		issueCount=0;
	  }
	  // Send mail
      transport.sendMail(message, function(error, response){
          if(error){
              console.log('Error occured');
              console.log(error.message);
              return;
          }else{
              //console.log(response);
              console.log('Message sent successfully!');
          }
      });
  }
  callback();
}

module.exports=errreport;