set define off 
 create or replace procedure TEST_PROCEDURE as 
 begin 
   owa_util.mime_header(ccontent_type=>'text/html'); 
   htp.p('<!DOCTYPE html>'); 
   htp.p('<html lang="en">'); 
   htp.p('  <head>'); 
   htp.p('    <meta charset="UTF-8" />'); 
   htp.p('    <meta http-equiv="X-UA-Compatible" content="IE=edge" />'); 
   htp.p('    <meta name="viewport" content="width=device-width, initial-scale=1.0" />'); 
   htp.p('    <title>Document</title>'); 
   htp.p('  </head>'); 
   htp.p('  <body>'); 
   htp.p('    <div>Тест</div>'); 
   htp.p('  </body>'); 
   htp.p('</html>'); 
   htp.p(''); 
 end; 
 / 
 exit