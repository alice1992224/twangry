var nodemailer = require('nodemailer');
var ccap = require('ccap');
var captchaArr = {};
var counter = 0;
var errreport = {};

errreport.route = function(tpl, args, ext, callback){

  if( args[1] == "getCaptcha"){
  
    var captcha = ccap();
    var ary = captcha.get();
    captchaArr[counter] = ary[0];
    args[2] = ary[1];
    console.log(ary[0]);
    counter++;
  }
  else{
      var transport = nodemailer.createTransport("Direct", {debug: true});
      myPost=tpl.get('post');
      tpl.set('post','');//clear
      myPost=JSON.parse(myPost);
      // Fill the email
      var message = {
          from: '\"'+myPost['email']+'\" <'+myPost['email']+'>',
          to: 'Supertang <super9817020@gmail.com>, Tsuyi <alice1992224@gmail.com>, Sue <WTChi.Sue@gmail.com>',
          subject: 'g0v政誌 Error Report--'+myPost['title'], 
          text: myPost['content']
      };
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